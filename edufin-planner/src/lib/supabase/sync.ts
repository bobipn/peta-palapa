"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreRisk } from "../engine/risk";
import { useStore } from "../store";
import { getSupabase } from "./client";
import { householdToRows, rowsToHousehold, rowsToSchoolDb, scheduleToRows, schoolToRow, type FamilyRows } from "./mapping";

function client(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase belum dikonfigurasi");
  return sb;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

/** Page through a table (PostgREST caps responses, 1000 rows by default). */
async function fetchAll(sb: SupabaseClient, table: string, filter?: [string, string]): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select("*").range(from, from + 999);
    if (filter) q = q.eq(filter[0], filter[1]);
    const rows = await must(q);
    out.push(...(rows as Record<string, unknown>[]));
    if ((rows as unknown[]).length < 1000) break;
  }
  return out;
}

/** Replace a family's rows in one table: upsert current rows, delete the ones that no longer exist. */
async function syncTable(sb: SupabaseClient, table: string, familyId: string, rows: Record<string, unknown>[], conflict = "id") {
  if (rows.length) await must(sb.from(table).upsert(rows, { onConflict: conflict }));
  if (conflict === "id") {
    const ids = rows.map((r) => r.id as string);
    let del = sb.from(table).delete().eq("family_id", familyId);
    if (ids.length) del = del.not("id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`);
    await must(del);
  }
}

export async function pushToCloud(): Promise<void> {
  const sb = client();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Belum masuk");
  const s = useStore.getState();
  const rows = householdToRows(s.household, s.assumptions, s.pinPlanDate, s.onboarded);
  const fid = rows.family.id as string;

  await must(sb.from("families").upsert({ ...rows.family, owner_id: auth.user.id }, { onConflict: "id" }));
  await syncTable(sb, "parents", fid, rows.parents);
  await must(sb.from("income").delete().eq("family_id", fid));
  if (rows.income.length) await must(sb.from("income").insert(rows.income));
  await syncTable(sb, "children", fid, rows.children);
  await syncTable(sb, "education_plans", fid, rows.education_plans);
  await syncTable(sb, "education_expenses", fid, rows.education_expenses);
  await syncTable(sb, "expenses", fid, rows.expenses);
  await syncTable(sb, "assets", fid, rows.assets);
  await syncTable(sb, "liabilities", fid, rows.liabilities);
  await must(sb.from("investments").upsert(rows.investments, { onConflict: "family_id,goal" }));
  await must(sb.from("assumptions").upsert(rows.assumptions, { onConflict: "family_id" }));
  if (rows.risk_profile) {
    const r = scoreRisk(s.household.riskAnswers);
    await must(
      sb.from("risk_profiles").upsert(
        { ...rows.risk_profile, profile: r.profile, ability: r.ability, willingness: r.willingness, total_score: r.totalScore },
        { onConflict: "family_id" },
      ),
    );
  }

  // Share the family's own submissions (User Submitted) with the database.
  const mine = s.overlay.schools.filter((x) => x.origin === "user");
  for (const school of mine) {
    await must(sb.from("schools").upsert({ ...schoolToRow(school), created_by: auth.user.id }, { onConflict: "id" }));
    for (const level of school.levels) await sb.from("school_levels").upsert({ school_id: school.id, level }, { onConflict: "school_id,level" });
  }
  for (const f of s.overlay.fees.filter((x) => x.provenance.verificationStatus === "user_submitted")) {
    const { fee, components } = scheduleToRows(f);
    await must(sb.from("school_fees").upsert({ ...fee, created_by: auth.user.id }, { onConflict: "id" }));
    if (components.length) await must(sb.from("school_fee_components").upsert(components, { onConflict: "id" }));
  }
  useStore.setState({ lastSyncedAt: new Date().toISOString() });
}

export async function pullFromCloud(): Promise<boolean> {
  const sb = client();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Belum masuk");
  const fams = await must(sb.from("families").select("*").eq("owner_id", auth.user.id).order("updated_at", { ascending: false }).limit(1));
  const family = (fams as Record<string, unknown>[])[0];
  if (!family) return false;
  const fid = family.id as string;
  const [parents, income, children, plans, planExpenses, expenses, assets, liabilities, investments] = await Promise.all(
    ["parents", "income", "children", "education_plans", "education_expenses", "expenses", "assets", "liabilities", "investments"].map((t) => fetchAll(sb, t, ["family_id", fid])),
  );
  const assumptions = await must(sb.from("assumptions").select("*").eq("family_id", fid).maybeSingle());
  const risk = await must(sb.from("risk_profiles").select("*").eq("family_id", fid).maybeSingle());
  const rows: FamilyRows = {
    family,
    parents,
    income,
    children,
    education_plans: plans,
    education_expenses: planExpenses,
    expenses,
    assets,
    liabilities,
    investments,
    assumptions: (assumptions as Record<string, unknown>) ?? { data: null },
    risk_profile: (risk as Record<string, unknown>) ?? null,
  };
  const r = rowsToHousehold(rows);
  const cur = useStore.getState();
  cur.replaceAll({
    household: r.household,
    assumptions: r.assumptions ? { ...cur.assumptions, ...r.assumptions } : cur.assumptions,
    pinPlanDate: r.pinPlanDate,
    onboarded: r.onboarded || cur.onboarded,
    lastSyncedAt: new Date().toISOString(),
  });
  return true;
}

/** Latest reference data from the cloud database (admin updates reach every user). */
export async function fetchCloudSchoolDb() {
  const sb = client();
  const [schools, levels, fees, components, history] = await Promise.all(
    ["schools", "school_levels", "school_fees", "school_fee_components", "school_fee_history"].map((t) => fetchAll(sb, t)),
  );
  return rowsToSchoolDb({ schools, levels, fees, components, history });
}
