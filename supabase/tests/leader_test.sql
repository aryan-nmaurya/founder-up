-- FounderUp - leader reigns (migration 0009)
--
-- Every board's #1 shows how long they have held it. These check that the
-- clock starts, carries on and changes hands exactly when #1 really changes.
-- Each line reads `ok` or `FAIL`, so `grep FAIL` is the whole verdict.
--
-- Safe to re-run: it truncates and rebuilds its own fixtures.

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off
\pset tuples_only on
\pset format unaligned

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
do $$ begin perform setval('public.founder_number_seq', 1, false); end $$;

create or replace function test_check(p_label text, p_pass boolean, p_detail text default null)
returns text language sql as $$
  select case when coalesce(p_pass, false) then 'ok    ' else 'FAIL  ' end
         || p_label || coalesce(' (' || p_detail || ')', '');
$$;

create or replace function test_refused(p_label text, p_sql text, p_error_like text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return test_check(p_label, false, 'was allowed');
exception when others then
  return test_check(p_label, sqlerrm like p_error_like, sqlerrm);
end $$;

-- A founder created the way onboarding creates one. Returns the profile id.
create or replace function test_lead_founder(p_username text, p_country text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_uid, p_username || '@test.local');
  perform set_config('request.jwt.claim.sub', v_uid::text, false);
  return (public.create_founder_profile(p_username, initcap(p_username), p_country, null) ->> 'id')::uuid;
end $$;

-- A captured boost, the way the webhook awards one. Returns the payment id.
create or replace function test_lead_pay(p_founder uuid, p_rupees bigint)
returns text language plpgsql as $$
declare v_order text := 'order_lead_' || replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.boost_orders (founder_id, requested_amount, requested_currency, razorpay_order_id)
  values (p_founder, p_rupees * 100, 'INR', v_order);
  perform public.award_rank_points('pay_' || v_order, v_order, 'INR', p_rupees * 100, p_rupees * 100, now());
  return 'pay_' || v_order;
end $$;

-- The sitting #1 of a board, and when their reign began.
create or replace function test_leader(p_board text, p_scope text)
returns uuid language sql as $$
  select founder_id from public.leader_reigns
   where board = p_board and scope = p_scope and ended_at is null
     and day_utc is not distinct from (case when p_board = 'TODAY' then (now() at time zone 'utc')::date end);
$$;

create or replace function test_reign_start(p_board text, p_scope text)
returns timestamptz language sql as $$
  select started_at from public.leader_reigns
   where board = p_board and scope = p_scope and ended_at is null
     and day_utc is not distinct from (case when p_board = 'TODAY' then (now() at time zone 'utc')::date end);
$$;


\echo ''
\echo '--- the clock starts when #1 is taken'
select test_lead_founder('mira', 'KE') as mira \gset
select test_check('the first founder leads the global board', test_leader('ALL_TIME', 'GLOBAL') = :'mira');
select test_check('...and their country''s board', test_leader('ALL_TIME', 'KE') = :'mira');
select test_check('nobody leads Today before anyone boosts', test_leader('TODAY', 'GLOBAL') is null);

select test_lead_founder('juma', 'KE') as juma \gset
select test_check('joining later at 0 RP does not take #1', test_leader('ALL_TIME', 'KE') = :'mira');


\echo ''
\echo '--- #1 changes hands only when #1 really changes'
select test_reign_start('ALL_TIME', 'KE') as mira_start \gset
select test_lead_pay(:'juma', 500) as juma_pay \gset
select test_check('boosting past the leader takes #1', test_leader('ALL_TIME', 'KE') = :'juma');
select test_check('the old reign is closed, not deleted',
  (select ended_at is not null from public.leader_reigns
    where board = 'ALL_TIME' and scope = 'KE' and founder_id = :'mira'));
select test_check('the new reign starts after the old one',
  test_reign_start('ALL_TIME', 'KE') > :'mira_start'::timestamptz);
select test_check('...on the global board too', test_leader('ALL_TIME', 'GLOBAL') = :'juma');
select test_check('...and on both Today boards',
  test_leader('TODAY', 'GLOBAL') = :'juma' and test_leader('TODAY', 'KE') = :'juma');

select test_reign_start('ALL_TIME', 'KE') as juma_start \gset
select test_lead_pay(:'juma', 100) as juma_pay_again \gset
select test_check('the leader boosting again keeps their clock',
  test_reign_start('ALL_TIME', 'KE') = :'juma_start'::timestamptz);
select test_check('...with still exactly one sitting #1',
  (select count(*) = 1 from public.leader_reigns
    where board = 'ALL_TIME' and scope = 'KE' and ended_at is null));

select test_lead_pay(:'mira', 1000) as mira_pay \gset
select test_check('a bigger boost takes #1 back',
  test_leader('ALL_TIME', 'KE') = :'mira' and test_leader('TODAY', 'GLOBAL') = :'mira');


\echo ''
\echo '--- reversals, suspensions and moves hand #1 on'
select test_check('fixture refund applied',
  public.revoke_rank_points(:'mira_pay', 'REFUND', 'test') ->> 'status' = 'REVOKED');
select test_check('a refund that drops the leader hands #1 back', test_leader('ALL_TIME', 'KE') = :'juma');
select test_check('...on Today as well', test_leader('TODAY', 'KE') = :'juma');

update public.profiles set is_suspended = true where id = :'juma';
select test_check('suspending the leader hands #1 on', test_leader('ALL_TIME', 'KE') = :'mira');
select test_check('...and clears a Today board nobody else has scored on', test_leader('TODAY', 'KE') is null);
update public.profiles set is_suspended = false where id = :'juma';
select test_check('lifting the suspension gives it back', test_leader('ALL_TIME', 'KE') = :'juma');

select auth_user_id as juma_uid from public.profiles where id = :'juma' \gset
set "request.jwt.claim.sub" = :'juma_uid';
do $$ begin perform public.change_country('UG'); end $$;
select test_check('changing country leaves the old board', test_leader('ALL_TIME', 'KE') = :'mira');
select test_check('...and leads the new one', test_leader('ALL_TIME', 'UG') = :'juma');


\echo ''
\echo '--- what the app reads'
select test_check('every board has at most one sitting #1', not exists (
  select 1 from public.leader_reigns where ended_at is null
   group by board, scope, day_utc having count(*) > 1));
select test_check('each leaderboard''s #1 is the sitting #1', bool_and(
    (select id from public.leaderboard_all_time(nullif(s, 'GLOBAL'), 1, 0))
      is not distinct from test_leader('ALL_TIME', s)))
  from unnest(array['GLOBAL', 'KE', 'UG']) s;
set role anon;
set "request.jwt.claim.sub" = '';
select test_check('anyone can read the sitting #1',
  (select founder_id = :'juma'::uuid and started_at <= now()
     from public.current_leader('ALL_TIME', 'UG')));
select test_check('...of the Today board too',
  (select founder_id = :'juma'::uuid from public.current_leader('TODAY', null)));
select test_refused('the reign history stays private',
  'select * from public.leader_reigns', '%permission denied%');
select test_refused('nobody outside the database can re-run the election',
  $q$select public.refresh_leader('ALL_TIME', 'GLOBAL')$q$, '%permission denied%');
reset role;


\echo ''
\echo '--- a deleted account hands #1 on'
delete from auth.users where id = :'juma_uid';
select test_check('the board it led has no #1 left', test_leader('ALL_TIME', 'UG') is null);
select test_check('the global board moves on', test_leader('ALL_TIME', 'GLOBAL') = :'mira');

\echo ''
\echo 'Done. Any line beginning FAIL is a failure.'
