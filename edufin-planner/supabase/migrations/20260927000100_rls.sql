-- Row Level Security
-- * Reference data: anyone can read non-archived rows; admins manage everything;
--   signed-in users may submit schools/fees as 'user_submitted' and edit their own submissions.
-- * Family data: only the owner of the family can read or write it.

alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.curriculums enable row level security;
alter table public.schools enable row level security;
alter table public.school_campuses enable row level security;
alter table public.school_levels enable row level security;
alter table public.universities enable row level security;
alter table public.school_fees enable row level security;
alter table public.school_fee_components enable row level security;
alter table public.school_fee_history enable row level security;
alter table public.inflation_rates enable row level security;
alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.income enable row level security;
alter table public.children enable row level security;
alter table public.education_plans enable row level security;
alter table public.education_expenses enable row level security;
alter table public.expenses enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.investments enable row level security;
alter table public.assumptions enable row level security;
alter table public.scenarios enable row level security;
alter table public.financial_projections enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.data_change_log enable row level security;

-- users ---------------------------------------------------------------------
create policy users_select_self on public.users for select using (id = auth.uid() or public.is_admin());
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;
-- Users may edit their own profile but cannot change their own role.
create policy users_update_self on public.users for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());
create policy users_admin_all on public.users for all using (public.is_admin()) with check (public.is_admin());

-- reference data: read -------------------------------------------------------
create policy locations_read on public.locations for select using (true);
create policy curriculums_read on public.curriculums for select using (true);
create policy schools_read on public.schools for select using (not archived or public.is_admin() or created_by = auth.uid());
create policy campuses_read on public.school_campuses for select using (true);
create policy levels_read on public.school_levels for select using (true);
create policy universities_read on public.universities for select using (true);
create policy fees_read on public.school_fees for select using (not archived or public.is_admin() or created_by = auth.uid());
create policy components_read on public.school_fee_components for select using (true);
create policy history_read on public.school_fee_history for select using (true);
create policy inflation_read on public.inflation_rates for select using (true);

-- reference data: admin write -------------------------------------------------
create policy locations_admin on public.locations for all using (public.is_admin()) with check (public.is_admin());
create policy curriculums_admin on public.curriculums for all using (public.is_admin()) with check (public.is_admin());
create policy schools_admin on public.schools for all using (public.is_admin()) with check (public.is_admin());
create policy campuses_admin on public.school_campuses for all using (public.is_admin()) with check (public.is_admin());
create policy levels_admin on public.school_levels for all using (public.is_admin()) with check (public.is_admin());
create policy universities_admin on public.universities for all using (public.is_admin()) with check (public.is_admin());
create policy fees_admin on public.school_fees for all using (public.is_admin()) with check (public.is_admin());
create policy components_admin on public.school_fee_components for all using (public.is_admin()) with check (public.is_admin());
create policy history_admin on public.school_fee_history for all using (public.is_admin()) with check (public.is_admin());
create policy inflation_admin on public.inflation_rates for all using (public.is_admin()) with check (public.is_admin());
create policy change_log_admin_read on public.data_change_log for select using (public.is_admin());

-- reference data: user submissions (always 'user_submitted', never verified) ----
create policy schools_user_insert on public.schools for insert to authenticated
  with check (origin = 'user' and created_by = auth.uid());
create policy schools_user_update on public.schools for update to authenticated
  using (origin = 'user' and created_by = auth.uid())
  with check (origin = 'user' and created_by = auth.uid());

create policy fees_user_insert on public.school_fees for insert to authenticated
  with check (verification_status = 'user_submitted' and created_by = auth.uid());
create policy fees_user_update on public.school_fees for update to authenticated
  using (verification_status = 'user_submitted' and created_by = auth.uid())
  with check (verification_status = 'user_submitted' and created_by = auth.uid());

create policy components_user_write on public.school_fee_components for all to authenticated
  using (exists (select 1 from public.school_fees f where f.id = fee_id and f.created_by = auth.uid() and f.verification_status = 'user_submitted'))
  with check (exists (select 1 from public.school_fees f where f.id = fee_id and f.created_by = auth.uid() and f.verification_status = 'user_submitted'));

create policy levels_user_write on public.school_levels for insert to authenticated
  with check (exists (select 1 from public.schools s where s.id = school_id and s.created_by = auth.uid() and s.origin = 'user'));

-- family data: owner only ------------------------------------------------------
create policy families_owner on public.families for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy parents_owner on public.parents for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy income_owner on public.income for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy children_owner on public.children for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy plans_owner on public.education_plans for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy edu_expenses_owner on public.education_expenses for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy expenses_owner on public.expenses for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy assets_owner on public.assets for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy liabilities_owner on public.liabilities for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy investments_owner on public.investments for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy assumptions_owner on public.assumptions for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy scenarios_owner on public.scenarios for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy projections_owner on public.financial_projections for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy risk_owner on public.risk_profiles for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));

-- Supabase exposes tables to the anon/authenticated roles via grants; RLS above does the filtering.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke insert, update, delete on public.data_change_log from authenticated;
