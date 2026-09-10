-- FounderUp - Early Founder tests
--
-- Covers the required cases except concurrent completion, which needs real
-- parallel sessions and lives in concurrency_test.sh.
--
-- Safe to re-run: it truncates and rebuilds its own fixtures.

\set ON_ERROR_STOP on
\pset pager off

\if :{?allow_destructive}
\else
\echo ''
\echo 'REFUSING TO RUN.'
\echo 'This suite truncates auth.users and every profile. It is for a local or'
\echo 'throwaway database only - never a database with real founders.'
\echo ''
\echo 'If this is a scratch database, re-run with:'
\echo '  psql "$PGURL" -v allow_destructive=1 -f <this file>'
\echo ''
\quit
\endif


truncate auth.users cascade;
truncate public.activity_events, public.webhook_events, public.audit_logs;
select setval('public.founder_number_seq', 1, false);

-- Completes onboarding the way the app does: as an authenticated user,
-- through the same function the server action calls.
create or replace function test_complete_onboarding(p_username text)
returns jsonb language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_result jsonb;
begin
  insert into auth.users (id, email) values (v_uid, p_username || '@test.local');
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  select public.create_founder_profile(p_username, initcap(p_username), 'IN', 'Building things')
    into v_result;
  return v_result;
end $$;

-- Authenticates only. Deliberately does not touch create_founder_profile.
create or replace function test_sign_in_only(p_email text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_uid, p_email);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  return v_uid;
end $$;

create or replace function test_pay(p_username text, p_currency text,
                                    p_amount bigint, p_base bigint)
returns jsonb language plpgsql as $$
declare v_f uuid; v_order text := 'order_' || p_username || '_' || floor(random()*100000)::text;
begin
  select id into v_f from public.profiles where username = p_username;
  insert into public.boost_orders (founder_id, requested_amount, requested_currency, razorpay_order_id)
  values (v_f, p_amount, p_currency, v_order);
  return public.award_rank_points('pay_' || v_order, v_order, p_currency, p_amount, p_base, now());
end $$;


\echo ''
\echo '=== TEST 6: authenticating alone does not consume a founder number ==='
select coalesce((select last_value from pg_sequences
                 where schemaname='public' and sequencename='founder_number_seq'), 0)
       as "sequence before (expect 0)";
select test_sign_in_only('lurker@test.local') is not null as "signed in";
select test_sign_in_only('lurker2@test.local') is not null as "signed in again";
select coalesce((select last_value from pg_sequences
                 where schemaname='public' and sequencename='founder_number_seq'), 0)
       as "sequence after 2 sign-ins (expect 0)";
select count(*) as "profiles created (expect 0)" from public.profiles;


\echo ''
\echo '=== TEST 1: the first completed profile becomes Early Founder #1 ==='
select test_complete_onboarding('founder001') -> 'founder_number' as "founder_number (expect 1)";
select founder_number, is_early_founder, is_ranked
  from public.profiles where username = 'founder001';


\echo ''
\echo '=== TEST 7: repeating the completion request issues no second number ==='
do $$
declare v_uid uuid; v_first jsonb; v_retry jsonb;
begin
  select auth_user_id into v_uid from public.profiles where username = 'founder001';
  perform set_config('request.jwt.claim.sub', v_uid::text, true);

  -- Same payload, as a network retry would send.
  v_retry := public.create_founder_profile('founder001', 'Founder001', 'IN', 'Building things');
  raise notice 'retry returned created=% number=%',
    v_retry->>'created', v_retry->>'founder_number';

  -- And a retry that arrives with a different username must not fork a profile.
  v_retry := public.create_founder_profile('someothername', 'Founder001', 'US', null);
  raise notice 'retry with new username returned created=% number=%',
    v_retry->>'created', v_retry->>'founder_number';

  if (select count(*) from public.profiles where auth_user_id = v_uid) <> 1 then
    raise notice 'FAIL: more than one profile for the user';
  else
    raise notice 'OK: still exactly one profile for the user';
  end if;
end $$;
select coalesce((select last_value from pg_sequences
                 where schemaname='public' and sequencename='founder_number_seq'), 0)
       as "sequence after retries (expect 1)";


\echo ''
\echo '=== TESTS 2,3,4: fill to #51 ==='
do $$
begin
  for i in 2..51 loop
    perform test_complete_onboarding('founder' || lpad(i::text, 3, '0'));
  end loop;
end $$;

select founder_number, username, is_early_founder, is_ranked, total_rank_points
  from public.profiles
 where founder_number in (1, 49, 50, 51)
 order by founder_number;


\echo ''
\echo '=== TEST 5: #51 starts Unranked and is absent from the leaderboard ==='
select is_ranked as "is_ranked (expect f)",
       total_rank_points as "points (expect 0)"
  from public.profiles where founder_number = 51;
select count(*) as "#51 rows on leaderboard (expect 0)"
  from public.leaderboard_all_time(null, 100, 0) where founder_number = 51;
select global_rank as "global_rank (expect null)", is_ranked
  from public.founder_ranks((select id from public.profiles where founder_number = 51));

\echo '--- and #50 IS on the leaderboard at 0 RP, with no payment records ---'
select count(*) as "#50 rows on leaderboard (expect 1)"
  from public.leaderboard_all_time(null, 100, 0) where founder_number = 50;
select count(*) as "payment rows for #50 (expect 0)"
  from public.payments p join public.profiles pr on pr.id = p.founder_id
 where pr.founder_number = 50;
select count(*) as "ledger rows for #50 (expect 0)"
  from public.rank_ledger l join public.profiles pr on pr.id = l.founder_id
 where pr.founder_number = 50;


\echo ''
\echo '=== TEST 10: early founder flag is true for 1-50 and false beyond ==='
select
  count(*) filter (where is_early_founder and founder_number <= 50) as "early in 1-50 (expect 50)",
  count(*) filter (where is_early_founder and founder_number > 50) as "early beyond 50 (expect 0)",
  count(*) filter (where not is_early_founder and founder_number <= 50) as "non-early in 1-50 (expect 0)"
  from public.profiles;


\echo ''
\echo '=== all spots claimed once #50 is issued, with no admin toggle ==='
select claimed, spots, remaining, all_claimed from public.early_founder_status();


\echo ''
\echo '=== TEST 9: deleting #12 does not free the number for reuse ==='
delete from auth.users
 where id = (select auth_user_id from public.profiles where founder_number = 12);
select count(*) as "#12 rows remaining (expect 0)"
  from public.profiles where founder_number = 12;

select test_complete_onboarding('founder052') ->> 'founder_number' as "next number (expect 52)";
select count(*) as "any #12 recreated (expect 0)"
  from public.profiles where founder_number = 12;
select is_early_founder as "#52 early (expect f)"
  from public.profiles where founder_number = 52;


\echo ''
\echo '=== TEST 12: a non-early founder becomes ranked after a qualifying payment ==='
select is_ranked as "before payment (expect f)"
  from public.profiles where username = 'founder051';
select test_pay('founder051', 'INR', 10000, 10000) ->> 'rank_points' as "Rs.100 -> RP";
select is_ranked as "after payment (expect t)", total_rank_points as "points (expect 100)"
  from public.profiles where username = 'founder051';
select count(*) as "now on leaderboard (expect 1)"
  from public.leaderboard_all_time(null, 100, 0) where founder_number = 51;


\echo ''
\echo '=== TEST 11: an Early Founder can still buy Rank Points normally ==='
select total_rank_points as "before (expect 0)"
  from public.profiles where username = 'founder001';
select test_pay('founder001', 'INR', 50000, 50000) ->> 'rank_points' as "Rs.500 -> RP";
select total_rank_points as "after (expect 500)", is_ranked, is_early_founder
  from public.profiles where username = 'founder001';
select rank as "leaderboard rank (expect 1)"
  from public.leaderboard_all_time(null, 100, 0) where founder_number = 1;


\echo ''
\echo '=== a reversal returns a paid founder to Unranked, but never an Early Founder ==='
select public.revoke_rank_points(
    (select razorpay_payment_id from public.payments p
       join public.profiles pr on pr.id = p.founder_id
      where pr.username = 'founder051'),
    'CHARGEBACK', 'test') ->> 'status' as "revoke #51";
select is_ranked as "#51 ranked after chargeback (expect f)"
  from public.profiles where username = 'founder051';

select public.revoke_rank_points(
    (select razorpay_payment_id from public.payments p
       join public.profiles pr on pr.id = p.founder_id
      where pr.username = 'founder001'),
    'REFUND', 'test') ->> 'status' as "revoke #1";
select is_ranked as "#1 ranked after refund (expect t)",
       total_rank_points as "points (expect 0)"
  from public.profiles where username = 'founder001';


\echo ''
\echo '=== SECURITY: the client cannot write founder identity fields ==='
select
  has_column_privilege('authenticated','public.profiles','founder_number','UPDATE')  as "write founder_number",
  has_column_privilege('authenticated','public.profiles','is_early_founder','UPDATE') as "write is_early_founder",
  has_column_privilege('authenticated','public.profiles','is_ranked','UPDATE')        as "write is_ranked",
  has_column_privilege('authenticated','public.profiles','profile_completed_at','UPDATE') as "write completed_at",
  has_column_privilege('authenticated','public.profiles','bio','UPDATE')              as "write bio (expect t)";

\echo '--- and the numbers are immutable even to the service role ---'
do $$
begin
  begin
    update public.profiles set founder_number = 3 where username = 'founder051';
    raise notice 'FAIL: founder_number was changed';
  exception when others then
    raise notice 'OK: founder_number change rejected (%)', sqlerrm;
  end;
  begin
    update public.profiles set is_early_founder = true where username = 'founder051';
    raise notice 'FAIL: is_early_founder was changed';
  exception when others then
    raise notice 'OK: is_early_founder change rejected (%)', sqlerrm;
  end;
end $$;

\echo ''
\echo '=== a suspended founder keeps their number ==='
update public.profiles set is_suspended = true where founder_number = 5;
select founder_number, is_early_founder, is_suspended
  from public.profiles where founder_number = 5;
update public.profiles set is_suspended = false where founder_number = 5;
