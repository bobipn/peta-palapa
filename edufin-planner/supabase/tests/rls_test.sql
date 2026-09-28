-- RLS & constraint tests. Run against a database with the migrations + seed applied
-- (see README, "Uji skema & RLS" — on plain Postgres run tests/local_auth_stub.sql first). Every block raises on failure.
\set ON_ERROR_STOP 1
\set u1 '11111111-1111-4111-8111-111111111111'
\set u2 '22222222-2222-4222-8222-222222222222'
\set fam 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

insert into auth.users (id, email) values (:'u1', 'u1@example.test'), (:'u2', 'u2@example.test');
do $$ begin if (select count(*) from public.users) < 2 then raise exception 'signup trigger did not create profiles'; end if; end $$;

-- 1. anon can read reference data but not write it
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin if (select count(*) from public.schools) < 40 then raise exception 'anon cannot read schools'; end if; end $$;
do $$ begin if (select count(*) from public.families) <> 0 then raise exception 'anon sees families'; end if; end $$;
do $$ begin
  begin
    insert into public.schools (id, name, ownership, city) values ('anon-x', 'X', 'swasta', 'Kota Depok');
    raise exception 'anon insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 2. family data is private to its owner
set role authenticated;
select set_config('request.jwt.claim.sub', :'u1', false);
insert into public.families (id, family_name) values (:'fam', 'Keluarga U1');
insert into public.children (family_id, name, birth_date) values (:'fam', 'Anak U1', '2020-01-01');
insert into public.expenses (family_id, category, monthly_amount) values (:'fam', 'food', 5000000);
select set_config('request.jwt.claim.sub', :'u2', false);
do $$ begin if (select count(*) from public.families) <> 0 then raise exception 'u2 sees u1 family'; end if; end $$;
do $$ begin if (select count(*) from public.children) <> 0 then raise exception 'u2 sees u1 children'; end if; end $$;
do $$ begin if (select count(*) from public.expenses) <> 0 then raise exception 'u2 sees u1 expenses'; end if; end $$;
do $$ begin
  begin
    insert into public.children (family_id, name, birth_date) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Intruder', '2020-01-01');
    raise exception 'cross-family insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ declare n int; begin
  update public.families set family_name = 'hacked' where true;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'u2 updated u1 family'; end if;
end $$;

-- 3. users can submit schools/fees only as user_submitted, and cannot touch researched data
select set_config('request.jwt.claim.sub', :'u1', false);
insert into public.schools (id, name, ownership, origin, city) values ('usr-test', 'Sekolah Uji', 'swasta', 'user', 'Kota Depok');
insert into public.school_fees (id, school_id, level, academic_year, source, source_type, verification_status)
  values ('usr-test-sd', 'usr-test', 'SD', '2026/2027', 'Brosur PPDB', 'user', 'user_submitted');
insert into public.school_fee_components (id, fee_id, code, label, cost_group, category, frequency, amount, inflation)
  values ('usr-test-sd-c1', 'usr-test-sd', 'spp_monthly', 'SPP', 'recurring', 'tuition', 'monthly', 1000000, 'school');
do $$ begin
  begin
    insert into public.school_fees (id, school_id, level, academic_year, source, source_type, verification_status, source_url)
      values ('usr-test-sd2', 'usr-test', 'SD', '2026/2027', 'Brosur', 'user', 'verified', 'https://example.test');
    raise exception 'user self-verification should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ declare n int; begin
  update public.school_fees set notes = 'tamper' where id like 'dpk-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'user modified researched fees'; end if;
end $$;
do $$ begin
  begin
    insert into public.school_fees (id, school_id, level, academic_year, source, source_type) values ('usr-nosrc', 'usr-test', 'SD', '2026/2027', '  ', 'user');
    raise exception 'fee without source should fail';
  exception when check_violation then null;
  end;
end $$;

-- 4. no role self-escalation
do $$ declare n int; begin
  begin
    update public.users set role = 'admin' where id = auth.uid();
    get diagnostics n = row_count;
    if n > 0 then raise exception 'role escalation succeeded'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. admins verify data; verified requires a URL; changes are logged
update public.users set role = 'admin' where id = :'u1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'u1', false);
update public.school_fees set verification_status = 'verified', source_url = 'https://example.test/ppdb', last_verified = current_date where id = 'usr-test-sd';
do $$ begin if (select verification_status from public.school_fees where id = 'usr-test-sd') <> 'verified' then raise exception 'admin verify failed'; end if; end $$;
do $$ begin
  begin
    update public.school_fees set source_url = null where id = 'usr-test-sd';
    raise exception 'verified without url should fail';
  exception when check_violation then null;
  end;
end $$;
do $$ begin if (select count(*) from public.data_change_log where record_id = 'usr-test-sd') < 2 then raise exception 'audit log missing'; end if; end $$;
reset role;

select 'ALL RLS TESTS PASSED' as result;
