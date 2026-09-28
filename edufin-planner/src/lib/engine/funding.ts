import { formatPct, formatRp, formatRpCompact } from "../format";
import { monthlyRate, paymentForTarget, periodicRate } from "./tvm";
import type { Explain } from "./types";

/** One education payment drawn from the education fund at the start of an academic year. */
export interface Withdrawal {
  month: number;
  ay: number;
  amount: number;
  label: string;
}

export interface ContributionSchedule {
  /** Amount per contribution period. */
  amountPerPeriod: number;
  periodsPerYear: 12 | 4 | 1;
  /** Contributions start after this many months (0 = first contribution at the end of month 1). */
  delayMonths: number;
  /** Last month in which a contribution may occur (inclusive). */
  endMonth: number;
  /** Annual increase of the contribution (step-up), applied every 12 months after the first deposit. */
  stepUp?: number;
}

export function contributionMonths(s: Pick<ContributionSchedule, "periodsPerYear" | "delayMonths" | "endMonth">): number[] {
  const step = 12 / s.periodsPerYear;
  const out: number[] = [];
  for (let m = s.delayMonths + step; m <= s.endMonth; m += step) out.push(m);
  return out;
}

/** Step-up factor for a contribution made in month m: (1 + g)^(completed years since the first deposit). */
export function stepFactor(m: number, delayMonths: number, periodsPerYear: 12 | 4 | 1, stepUp = 0): number {
  if (!stepUp) return 1;
  const first = delayMonths + 12 / periodsPerYear;
  return Math.pow(1 + stepUp, Math.floor((m - first) / 12));
}

export interface FundEvent {
  month: number;
  ay: number;
  label: string;
  amount: number;
  paid: number;
  shortfall: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface FundSimulation {
  events: FundEvent[];
  /** Balance at the end of each month, index = month (0 = today). */
  balances: number[];
  totalPaid: number;
  totalShortfall: number;
  shortfallPv: number;
  totalContributed: number;
  totalReturn: number;
}

/**
 * Month-by-month simulation of the education fund:
 *   balance_m = balance_{m−1} × (1 + r_m) + contribution_m − withdrawal_m
 * A withdrawal larger than the balance is paid partially; the remainder is a shortfall
 * (it must come from cash flow). The balance never goes negative.
 */
export function simulateFund(
  initial: number,
  withdrawals: Withdrawal[],
  schedule: ContributionSchedule,
  annualReturn: number,
): FundSimulation {
  const rm = monthlyRate(annualReturn);
  const last = withdrawals.reduce((mx, w) => Math.max(mx, w.month), 0);
  const contribSet = new Set(contributionMonths({ ...schedule, endMonth: Math.min(schedule.endMonth, last) }));
  const amountAt = (m: number) =>
    schedule.amountPerPeriod * stepFactor(m, schedule.delayMonths, schedule.periodsPerYear, schedule.stepUp);
  const byMonth = new Map<number, Withdrawal[]>();
  for (const w of withdrawals) {
    const list = byMonth.get(w.month) ?? [];
    list.push(w);
    byMonth.set(w.month, list);
  }
  const balances: number[] = [initial];
  let bal = initial;
  const events: FundEvent[] = [];
  let totalPaid = 0;
  let totalShortfall = 0;
  let shortfallPv = 0;
  let totalContributed = 0;
  let totalReturn = 0;
  // Month 0 withdrawals (payment due today) can only use the initial balance.
  for (const w of byMonth.get(0) ?? []) {
    const paid = Math.min(bal, w.amount);
    events.push({ month: 0, ay: w.ay, label: w.label, amount: w.amount, paid, shortfall: w.amount - paid, balanceBefore: bal, balanceAfter: bal - paid });
    bal -= paid;
    totalPaid += paid;
    totalShortfall += w.amount - paid;
    shortfallPv += w.amount - paid;
  }
  balances[0] = bal;
  for (let m = 1; m <= last; m++) {
    const growth = bal * rm;
    bal += growth;
    totalReturn += growth;
    if (contribSet.has(m)) {
      const amt = amountAt(m);
      bal += amt;
      totalContributed += amt;
    }
    for (const w of byMonth.get(m) ?? []) {
      const before = bal;
      const paid = Math.min(bal, w.amount);
      bal -= paid;
      const sf = w.amount - paid;
      totalPaid += paid;
      totalShortfall += sf;
      shortfallPv += sf / Math.pow(1 + rm, m);
      events.push({ month: m, ay: w.ay, label: w.label, amount: w.amount, paid, shortfall: sf, balanceBefore: before, balanceAfter: bal });
    }
    balances.push(bal);
  }
  return { events, balances, totalPaid, totalShortfall, shortfallPv, totalContributed, totalReturn };
}

export interface RequiredContribution {
  /** Amount per contribution period (first year when a step-up applies). */
  perPeriod: number;
  /** Monthly equivalent (perPeriod × periods per year / 12). */
  monthlyEquivalent: number;
  periodsPerYear: 12 | 4 | 1;
  stepUp: number;
  /** Index of the withdrawal whose funding constraint binds (the hardest payment to meet). */
  bindingIndex: number | null;
  /**
   * Nominal part of the payments due before the first contribution that the current fund cannot pay.
   * Unavoidable with this schedule: it must come from cash flow or a lump sum and is excluded from `perPeriod`.
   */
  unreachableShortfall: number;
  /**
   * PV method for comparison: contributions whose PV equals PV(requirement) − current fund.
   * Lower than the strict figure when early payments would need temporary help from cash.
   */
  pvMethodMonthly: number;
}

/**
 * Minimum contribution such that no payment after the first deposit falls short.
 *
 * Phase 1 — payments due before the first deposit can only use the current fund. Whatever the
 * fund cannot pay is an unavoidable shortfall (it must come from cash flow or a lump sum); it is
 * reported as `unreachableShortfall` and NOT carried into the contribution requirement, exactly as
 * simulateFund behaves (the balance never goes negative, so a shortfall is not "repaid" later).
 *
 * Phase 2 — for each remaining withdrawal k at month m_k the balance right after paying it must be ≥ 0:
 *   A_k + C·S_k − L_k ≥ 0
 * where A_k is the fund left after phase 1 grown to m_k, L_k = Σ_{j≤k} W_j·(1+r)^{m_k−m_j} over the
 * phase-2 payments, and S_k the future value at m_k of one unit per period (scaled by the step-up)
 * contributed up to m_k.  C = max_k (L_k − A_k) / S_k.
 * The PV method (a single constraint at the last payment) is a lower bound.
 */
export function requiredContribution(
  initial: number,
  withdrawals: Withdrawal[],
  annualReturn: number,
  periodsPerYear: 12 | 4 | 1,
  delayMonths = 0,
  stepUp = 0,
): RequiredContribution {
  const ws = [...withdrawals].filter((w) => w.amount > 0).sort((a, b) => a.month - b.month);
  const rm = monthlyRate(annualReturn);
  const last = ws.length ? ws[ws.length - 1].month : 0;
  const months = contributionMonths({ periodsPerYear, delayMonths, endMonth: last });
  const weight = months.map((m) => stepFactor(m, delayMonths, periodsPerYear, stepUp));
  const firstDeposit = months.length ? months[0] : Number.POSITIVE_INFINITY;

  // Phase 1: payments before the first deposit (a deposit in month m is available for a payment in month m).
  let fund = initial;
  let fundMonth = 0;
  let unreachable = 0;
  let k0 = 0;
  for (; k0 < ws.length && ws[k0].month < firstDeposit; k0++) {
    const w = ws[k0];
    fund *= Math.pow(1 + rm, w.month - fundMonth);
    fundMonth = w.month;
    const paid = Math.min(fund, w.amount);
    fund -= paid;
    unreachable += w.amount - paid;
  }

  // Phase 2: binding no-shortfall constraint over the remaining payments.
  let best = 0;
  let bindingIndex: number | null = null;
  let liability = 0;
  let prevMonth = fundMonth;
  for (let k = k0; k < ws.length; k++) {
    const w = ws[k];
    liability = liability * Math.pow(1 + rm, w.month - prevMonth) + w.amount;
    prevMonth = w.month;
    const assets = fund * Math.pow(1 + rm, w.month - fundMonth);
    // S_k > 0 here because m_k ≥ first deposit month.
    let sk = 0;
    for (let i = 0; i < months.length && months[i] <= w.month; i++) sk += weight[i] * Math.pow(1 + rm, w.month - months[i]);
    const need = liability - assets;
    if (need <= 0) continue;
    const c = need / sk;
    if (c > best) {
      best = c;
      bindingIndex = k;
    }
  }
  const pvReq = ws.slice(k0).reduce((s, w) => s + w.amount / Math.pow(1 + rm, w.month), 0);
  const pvFund = fund / Math.pow(1 + rm, fundMonth);
  const pvUnit = months.reduce((s, m, i) => s + weight[i] / Math.pow(1 + rm, m), 0);
  const pvPerPeriod = pvUnit > 0 ? Math.max(0, (pvReq - pvFund) / pvUnit) : 0;
  return {
    perPeriod: best,
    monthlyEquivalent: (best * periodsPerYear) / 12,
    periodsPerYear,
    stepUp,
    bindingIndex,
    unreachableShortfall: unreachable,
    pvMethodMonthly: (pvPerPeriod * periodsPerYear) / 12,
  };
}

/** Present value of withdrawals at the fund's expected return (monthly compounding). */
export function pvOfWithdrawals(withdrawals: Withdrawal[], annualReturn: number): number {
  const rm = monthlyRate(annualReturn);
  return withdrawals.reduce((s, w) => s + w.amount / Math.pow(1 + rm, w.month), 0);
}

export function pvOfContributions(schedule: ContributionSchedule, annualReturn: number): number {
  const rm = monthlyRate(annualReturn);
  return contributionMonths(schedule).reduce(
    (s, m) => s + (schedule.amountPerPeriod * stepFactor(m, schedule.delayMonths, schedule.periodsPerYear, schedule.stepUp)) / Math.pow(1 + rm, m),
    0,
  );
}

/** Additional lump sum needed today so that the planned contributions cover every payment. */
export function additionalLumpSum(
  initial: number,
  withdrawals: Withdrawal[],
  schedule: ContributionSchedule,
  annualReturn: number,
): number {
  const ws = [...withdrawals].sort((a, b) => a.month - b.month);
  const rm = monthlyRate(annualReturn);
  const months = contributionMonths(schedule);
  let needToday = 0;
  let liability = 0;
  let prev = 0;
  for (const w of ws) {
    liability = liability * Math.pow(1 + rm, w.month - prev) + w.amount;
    prev = w.month;
    const contribFv = months
      .filter((m) => m <= w.month)
      .reduce(
        (s, m) =>
          s + schedule.amountPerPeriod * stepFactor(m, schedule.delayMonths, schedule.periodsPerYear, schedule.stepUp) * Math.pow(1 + rm, w.month - m),
        0,
      );
    const required = (liability - contribFv) / Math.pow(1 + rm, w.month);
    needToday = Math.max(needToday, required);
  }
  return Math.max(0, needToday - initial);
}

export type FundingStatus = "fully_funded" | "partially_funded" | "funding_gap";

export const FUNDING_STATUS_LABEL: Record<FundingStatus, string> = {
  fully_funded: "Fully Funded",
  partially_funded: "Partially Funded",
  funding_gap: "Funding Gap",
};

export interface FundingResult {
  withdrawals: Withdrawal[];
  requirementNominal: number;
  requirementPv: number;
  /** Requirement in today's money (deflated with general inflation). */
  requirementReal: number;
  currentFund: number;
  plannedMonthly: number;
  schedule: ContributionSchedule;
  pvPlannedContributions: number;
  fundedRatio: number;
  simulation: FundSimulation;
  coveredByCurrentFund: number;
  coveredByContributions: number;
  gapNominal: number;
  gapPv: number;
  required: RequiredContribution;
  /** Level (no step-up) requirement, for comparison. */
  requiredLevel: RequiredContribution;
  /** Step-up requirement: the plan's own step-up, or ILLUSTRATIVE_STEP_UP when the plan is level. */
  requiredStepUp: RequiredContribution;
  additionalLumpSumToday: number;
  status: FundingStatus;
  explains: Record<"requirement" | "pv" | "gap" | "required" | "ratio", Explain>;
}

/** Illustrative annual contribution increase shown when the plan uses level contributions (an assumption, not a salary forecast). */
export const ILLUSTRATIVE_STEP_UP = 0.05;

export interface FundingInput {
  withdrawals: Withdrawal[];
  currentFund: number;
  plannedMonthly: number;
  annualReturn: number;
  generalInflation: number;
  periodsPerYear: 12 | 4 | 1;
  delayMonths: number;
  partialThreshold: number;
  /** Annual increase of planned contributions (0 = level). */
  stepUp?: number;
}

export function analyzeFunding(input: FundingInput): FundingResult {
  const ws = [...input.withdrawals].filter((w) => w.amount > 0).sort((a, b) => a.month - b.month);
  const lastMonth = ws.length ? ws[ws.length - 1].month : 0;
  const step = 12 / input.periodsPerYear;
  const schedule: ContributionSchedule = {
    amountPerPeriod: input.plannedMonthly * step,
    periodsPerYear: input.periodsPerYear,
    delayMonths: input.delayMonths,
    endMonth: lastMonth,
    stepUp: input.stepUp ?? 0,
  };
  const requirementNominal = ws.reduce((s, w) => s + w.amount, 0);
  const requirementPv = pvOfWithdrawals(ws, input.annualReturn);
  const requirementReal = ws.reduce((s, w) => s + w.amount / Math.pow(1 + input.generalInflation, w.month / 12), 0);
  const simulation = simulateFund(input.currentFund, ws, schedule, input.annualReturn);
  const simFundOnly = simulateFund(input.currentFund, ws, { ...schedule, amountPerPeriod: 0 }, input.annualReturn);
  const pvContrib = pvOfContributions(schedule, input.annualReturn);
  const fundedRatio = requirementPv > 0 ? (input.currentFund + pvContrib) / requirementPv : 1;
  const required = requiredContribution(input.currentFund, ws, input.annualReturn, input.periodsPerYear, input.delayMonths, input.stepUp ?? 0);
  const requiredLevel =
    input.stepUp && input.stepUp > 0 ? requiredContribution(input.currentFund, ws, input.annualReturn, input.periodsPerYear, input.delayMonths, 0) : required;
  const requiredStepUp =
    input.stepUp && input.stepUp > 0
      ? required
      : requiredContribution(input.currentFund, ws, input.annualReturn, input.periodsPerYear, input.delayMonths, ILLUSTRATIVE_STEP_UP);
  const lump = additionalLumpSum(input.currentFund, ws, schedule, input.annualReturn);
  const gapNominal = simulation.totalShortfall;
  const status: FundingStatus =
    gapNominal < 1 ? "fully_funded" : fundedRatio >= input.partialThreshold ? "partially_funded" : "funding_gap";

  const binding = required.bindingIndex !== null ? ws[required.bindingIndex] : undefined;
  const r = input.annualReturn;
  const explains: FundingResult["explains"] = {
    requirement: {
      title: "Education Funding Requirement (nominal)",
      inputs: ws.slice(0, 12).map((w) => ({ label: w.label, value: formatRp(w.amount) })),
      formula: "Requirement = Σ biaya tahun ajaran mendatang (nominal, setelah inflasi)",
      assumptions: [
        "Biaya tahun ajaran berjalan dibayar dari arus kas bulanan, tidak termasuk kebutuhan dana.",
        "Seluruh biaya satu tahun ajaran diasumsikan ditarik dari dana pendidikan pada awal tahun ajaran (Juli).",
      ],
      result: formatRp(requirementNominal),
      notes: ws.length > 12 ? [`…dan ${ws.length - 12} pembayaran lainnya.`] : undefined,
    },
    pv: {
      title: "Present Value kebutuhan dana",
      inputs: [
        { label: "Kebutuhan nominal", value: formatRp(requirementNominal) },
        { label: "Return dana pendidikan", value: formatPct(r) },
        { label: "Jumlah pembayaran", value: String(ws.length) },
      ],
      formula: "PV = Σ W_k / (1 + r_bulanan)^(m_k),   r_bulanan = (1 + r)^(1/12) − 1",
      substitution: `r_bulanan = (1 + ${formatPct(r)})^(1/12) − 1 = ${formatPct(monthlyRate(r), 3)}`,
      assumptions: [`Tingkat diskonto = expected return dana pendidikan ${formatPct(r)} (asumsi, bukan jaminan).`],
      result: formatRp(requirementPv),
      notes: [`Dalam nilai uang hari ini (dideflasi inflasi umum ${formatPct(input.generalInflation)}): ${formatRp(requirementReal)}.`],
    },
    gap: {
      title: "Funding Gap",
      inputs: [
        { label: "Kebutuhan nominal", value: formatRp(requirementNominal) },
        { label: "Dibayar dari dana saat ini (termasuk imbal hasil)", value: formatRp(simFundOnly.totalPaid) },
        { label: "Dibayar dari investasi rutin (termasuk imbal hasil)", value: formatRp(simulation.totalPaid - simFundOnly.totalPaid) },
        { label: "Investasi rutin direncanakan", value: `${formatRp(input.plannedMonthly)}/bulan` },
      ],
      formula: "Gap = Kebutuhan − dibayar dari dana saat ini − dibayar dari investasi rutin (simulasi bulanan)",
      substitution: `${formatRpCompact(requirementNominal)} − ${formatRpCompact(simFundOnly.totalPaid)} − ${formatRpCompact(
        simulation.totalPaid - simFundOnly.totalPaid,
      )}`,
      assumptions: [
        `Return dana pendidikan ${formatPct(r)} per tahun, dimajemukkan bulanan.`,
        "Jika saldo tidak cukup saat pembayaran, kekurangan dicatat sebagai gap (harus ditutup arus kas).",
      ],
      result: `${formatRp(gapNominal)} (PV ${formatRp(simulation.shortfallPv)})`,
    },
    required: {
      title: "Required Monthly Investment",
      inputs: [
        { label: "Dana pendidikan saat ini", value: formatRp(input.currentFund) },
        { label: "Return", value: formatPct(r) },
        { label: "Frekuensi investasi", value: input.periodsPerYear === 12 ? "bulanan" : input.periodsPerYear === 4 ? "kuartalan" : "tahunan" },
        { label: "Mulai investasi", value: input.delayMonths > 0 ? `setelah ${input.delayMonths} bulan` : "bulan depan" },
        { label: "Kenaikan setoran per tahun", value: input.stepUp ? formatPct(input.stepUp) : "0% (level)" },
      ],
      formula:
        "C = maks_k [ (Σ_{j≤k} W_j(1+r)^{m_k−m_j} − F0(1+r)^{m_k}) / S_k ],  S_k = nilai akhir anuitas 1 rupiah per periode hingga m_k",
      substitution: binding ? `Batasan terketat: ${binding.label} (${formatRp(binding.amount)})` : undefined,
      assumptions: [
        "Setoran tetap (level) di akhir setiap periode sampai pembayaran terakhir.",
        "Saldo dana tidak boleh negatif pada setiap tanggal pembayaran (tanpa pinjaman sementara).",
      ],
      result: `${formatRp(required.monthlyEquivalent)}/bulan`,
      notes: [
        `Metode PV (kekurangan sementara boleh ditalangi kas): ${formatRp(required.pvMethodMonthly)}/bulan.`,
        ...(input.stepUp ? [`Tanpa kenaikan (level): ${formatRp(requiredLevel.monthlyEquivalent)}/bulan.`] : []),
        ...(required.unreachableShortfall > 0
          ? [`${formatRp(required.unreachableShortfall)} jatuh tempo sebelum setoran pertama dan tidak tertutup dana saat ini — perlu dana tunai/lump sum; tidak dibebankan ke setoran di atas.`]
          : []),
      ],
    },
    ratio: {
      title: "Funded ratio",
      inputs: [
        { label: "Dana saat ini", value: formatRp(input.currentFund) },
        { label: "PV investasi rutin", value: formatRp(pvContrib) },
        { label: "PV kebutuhan", value: formatRp(requirementPv) },
      ],
      formula: "Funded ratio = (Dana saat ini + PV investasi rutin) / PV kebutuhan",
      assumptions: [
        `Status: Fully Funded bila simulasi tanpa kekurangan; Partially Funded bila rasio ≥ ${formatPct(input.partialThreshold, 0)}; selain itu Funding Gap.`,
      ],
      result: formatPct(fundedRatio),
    },
  };

  return {
    withdrawals: ws,
    requirementNominal,
    requirementPv,
    requirementReal,
    currentFund: input.currentFund,
    plannedMonthly: input.plannedMonthly,
    schedule,
    pvPlannedContributions: pvContrib,
    fundedRatio,
    simulation,
    coveredByCurrentFund: simFundOnly.totalPaid,
    coveredByContributions: simulation.totalPaid - simFundOnly.totalPaid,
    gapNominal,
    gapPv: simulation.shortfallPv,
    required,
    requiredLevel,
    requiredStepUp,
    additionalLumpSumToday: lump,
    status,
    explains,
  };
}

// ---------------------------------------------------------------------------
// Simple single-goal calculator (spec §11 inputs)
// ---------------------------------------------------------------------------

export interface SimpleGoalInput {
  currentFund: number;
  targetFutureValue: number;
  yearsRemaining: number;
  annualReturn: number;
  periodsPerYear: 12 | 4 | 1;
}

export function simpleGoalPayment(i: SimpleGoalInput): { perPeriod: number; monthlyEquivalent: number; explain: Explain } {
  const rp = periodicRate(i.annualReturn, i.periodsPerYear);
  const n = Math.round(i.yearsRemaining * i.periodsPerYear);
  const perPeriod = paymentForTarget(i.targetFutureValue, i.currentFund, rp, n);
  const monthlyEquivalent = (perPeriod * i.periodsPerYear) / 12;
  return {
    perPeriod,
    monthlyEquivalent,
    explain: {
      title: "Required investment (single target)",
      inputs: [
        { label: "Dana saat ini (PV)", value: formatRp(i.currentFund) },
        { label: "Target nilai masa depan (FV)", value: formatRp(i.targetFutureValue) },
        { label: "Sisa waktu", value: `${i.yearsRemaining} tahun (${n} periode)` },
        { label: "Expected return", value: formatPct(i.annualReturn) },
      ],
      formula: "PMT = (FV − PV·(1+r)^n) · r / ((1+r)^n − 1),   r = (1 + return)^(1/frekuensi) − 1",
      substitution: `r = ${formatPct(rp, 3)} per periode, n = ${n}`,
      assumptions: ["Setoran di akhir periode; return konstan (asumsi, bukan jaminan)."],
      result: `${formatRp(perPeriod)} per periode (${formatRp(monthlyEquivalent)}/bulan setara)`,
    },
  };
}
