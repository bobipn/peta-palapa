-- EduFin Planner — relational schema (PostgreSQL / Supabase)
-- Reference data (schools, fees, history, inflation) is public-read and admin-write.
-- Family data is private: every row belongs to a family owned by auth.uid().
-- Every fee schedule carries provenance: source, source_url, data date, academic year,
-- last verified, verification status and data confidence (product spec §22).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'admin', 'advisor');
create type public.verification_status as enum ('verified', 'partially_verified', 'user_submitted', 'estimated', 'outdated');
create type public.data_confidence as enum ('high', 'medium', 'low');
create type public.education_level as enum ('TK', 'SD', 'SMP', 'SMA', 'SMK', 'D3', 'S1', 'S2');
create type public.cost_group as enum ('entry', 'recurring', 'operational', 'optional');
create type public.fee_frequency as enum ('one_time', 'monthly', 'semester', 'annual');

-- ---------------------------------------------------------------------------
-- Users (profile + role) — mirrors auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Reference data: locations, curricula, schools
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  city text not null,
  district text,
  unique nulls not distinct (province, city, district)
);

create table public.curriculums (
  id text primary key,
  name text not null,
  description text
);

create table public.schools (
  id text primary key,                         -- school_id (stable slug)
  name text not null check (length(trim(name)) > 0),
  foundation text,
  ownership text not null check (ownership in ('negeri', 'swasta')),
  is_university boolean not null default false,
  categories text[] not null default '{}',
  curricula text[] not null default '{}',
  -- primary location (additional campuses live in school_campuses)
  province text not null default 'Jawa Barat',
  city text not null,
  district text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  location_id uuid references public.locations (id),
  website text,
  origin text not null default 'user' check (origin in ('seed', 'admin', 'user')),
  archived boolean not null default false,
  notes text,
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.schools (city);

create table public.school_campuses (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools (id) on delete cascade,
  name text,
  location_id uuid references public.locations (id),
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_primary boolean not null default true
);
create index on public.school_campuses (school_id);

create table public.school_levels (
  school_id text not null references public.schools (id) on delete cascade,
  level public.education_level not null,
  primary key (school_id, level)
);

create table public.universities (
  school_id text primary key references public.schools (id) on delete cascade,
  short_name text,
  university_type text,                        -- PTN-BH, PTN-BLU, PTS, kedinasan
  notes text
);

-- A fee schedule: school × level × academic year × program, with provenance
create table public.school_fees (
  id text primary key,
  school_id text not null references public.schools (id) on delete cascade,
  level public.education_level not null,
  program text,
  academic_year text not null check (academic_year ~ '^\d{4}/\d{4}$'),
  months_billed smallint not null default 12 check (months_billed between 1 and 12),
  is_primary boolean not null default false,
  incomplete boolean not null default false,
  archived boolean not null default false,
  notes text,
  source text not null check (length(trim(source)) > 0),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  source_type text not null,
  data_date date,
  accessed_date date,
  last_verified date,
  verification_status public.verification_status not null default 'user_submitted',
  data_confidence public.data_confidence not null default 'medium',
  evidence text,
  provenance_notes text,
  academic_year_inferred boolean not null default false,
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_requires_url check (verification_status <> 'verified' or source_url is not null)
);
create index on public.school_fees (school_id, level, academic_year);
create index on public.school_fees (verification_status);

create table public.school_fee_components (
  id text primary key,
  fee_id text not null references public.school_fees (id) on delete cascade,
  sort_order int not null default 0,
  code text not null,
  label text not null,
  cost_group public.cost_group not null,
  category text not null,
  frequency public.fee_frequency not null,
  amount numeric(16, 0) not null check (amount >= 0),
  amount_min numeric(16, 0),
  amount_max numeric(16, 0),
  inflation text not null check (inflation in ('school', 'education', 'general')),
  included boolean,
  excluded boolean not null default false,
  excluded_reason text,
  estimated boolean not null default false,
  frequency_inferred boolean not null default false,
  from_grade smallint,
  to_grade smallint,
  tier_group text,
  tier_label text,
  tier_default boolean,
  verbatim text,
  note text
);
create index on public.school_fee_components (fee_id);

create table public.school_fee_history (
  id text primary key,
  school_id text not null references public.schools (id) on delete cascade,
  level public.education_level not null,
  program text,
  component_code text not null,
  frequency public.fee_frequency not null,
  academic_year text not null check (academic_year ~ '^\d{4}/\d{4}$'),
  amount numeric(16, 0) not null check (amount > 0),
  source text not null check (length(trim(source)) > 0),
  source_url text,
  source_type text,
  data_date date,
  accessed_date date,
  verification_status public.verification_status not null,
  data_confidence public.data_confidence not null,
  notes text
);
create index on public.school_fee_history (school_id, level, component_code);

-- Reference macro series (BI/BPS) used to inform assumptions — never used as a hidden default
create table public.inflation_rates (
  id uuid primary key default gen_random_uuid(),
  series text not null,
  period text not null,
  value_pct numeric(7, 3) not null,
  base_year text,
  source text,
  source_url text,
  source_type text,
  accessed_date date,
  evidence text,
  verbatim text,
  unique (series, period)
);

-- ---------------------------------------------------------------------------
-- Family data (private)
-- ---------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  family_name text,
  home_city text,
  home_lat numeric(9, 6),
  home_lng numeric(9, 6),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.families (owner_id);

create or replace function public.owns_family(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.families where id = fid and owner_id = auth.uid());
$$;

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('primary', 'spouse')),
  name text,
  age int check (age between 15 and 110),
  marital_status text,
  occupation text,
  retirement_age int,
  target_retirement_age int,
  unique (family_id, role)
);

create table public.income (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  kind text not null check (kind in ('salary', 'bonus', 'other', 'pension')),
  amount numeric(16, 0) not null default 0 check (amount >= 0),
  frequency text not null check (frequency in ('monthly', 'annual')),
  growth numeric(6, 4),
  unique (parent_id, kind)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text,
  gender char(1) check (gender in ('L', 'P')),
  birth_date date not null,
  color_index int,
  current_level text,
  current_grade int,
  current_school_id text references public.schools (id) on delete set null,
  current_school_name text,
  target_education text,
  secondary_track text,
  include_tk boolean not null default true,
  include_s2 boolean not null default false,
  education_location text,
  target_school_name text,
  target_university_name text,
  target_sd_entry_year int,
  target_university_entry_year int
);

create table public.education_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  level public.education_level not null,
  mode text not null check (mode in ('school', 'custom', 'benchmark', 'none')),
  school_id text references public.schools (id) on delete set null,
  fee_id text references public.school_fees (id) on delete set null,
  custom_academic_year int,
  custom_inflation text,
  benchmark_category text,
  include_optional text[] not null default '{}',
  tier_choices jsonb not null default '{}'::jsonb,
  unique (child_id, level)
);

-- Family-entered cost lines: custom schedules and extra operational costs of a plan
create table public.education_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  plan_id uuid not null references public.education_plans (id) on delete cascade,
  kind text not null check (kind in ('custom', 'extra')),
  sort_order int not null default 0,
  code text not null,
  label text not null,
  cost_group public.cost_group not null,
  category text not null,
  frequency public.fee_frequency not null,
  amount numeric(16, 0) not null check (amount >= 0),
  inflation text not null,
  included boolean,
  note text
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  category text not null,
  label text,
  monthly_amount numeric(16, 0) not null default 0 check (monthly_amount >= 0),
  growth numeric(6, 4)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  type text not null,
  label text,
  value numeric(18, 0) not null default 0 check (value >= 0),
  asset_class text,
  growth numeric(6, 4)
);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  type text not null,
  label text,
  outstanding numeric(18, 0) not null default 0 check (outstanding >= 0),
  annual_rate numeric(6, 4) not null default 0,
  monthly_payment numeric(16, 0) not null default 0,
  remaining_months int not null default 0
);

-- Planned goal contributions (education fund, retirement fund)
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  goal text not null check (goal in ('education', 'retirement', 'general')),
  monthly_contribution numeric(16, 0) not null default 0 check (monthly_contribution >= 0),
  step_up numeric(6, 4) not null default 0,
  delay_months int not null default 0,
  unique (family_id, goal)
);

create table public.assumptions (
  family_id uuid primary key references public.families (id) on delete cascade,
  data jsonb not null,
  pin_plan_date boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  modifiers jsonb not null default '{}'::jsonb,
  unique (family_id, code)
);

-- Snapshot of engine outputs when a report is generated (audit trail of what was shown)
create table public.financial_projections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  generated_at timestamptz not null default now(),
  scenario_code text not null default 'A',
  assumptions jsonb not null,
  summary jsonb not null,
  rows jsonb
);

create table public.risk_profiles (
  family_id uuid primary key references public.families (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  profile text,
  ability text,
  willingness text,
  total_score int,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log for reference data changes (who changed which fee, when)
-- ---------------------------------------------------------------------------
create table public.data_change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.data_change_log (table_name, record_id, action, old_row, new_row)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger schools_audit after insert or update or delete on public.schools for each row execute function public.log_change();
create trigger school_fees_audit after insert or update or delete on public.school_fees for each row execute function public.log_change();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger schools_touch before update on public.schools for each row execute function public.touch_updated_at();
create trigger school_fees_touch before update on public.school_fees for each row execute function public.touch_updated_at();
create trigger families_touch before update on public.families for each row execute function public.touch_updated_at();
