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

-- helper: create an auth user + profile the way onboarding does
create or replace function test_founder(p_username text, p_name text, p_country text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_id uuid;
begin
  -- id is supplied explicitly: real Supabase's auth.users has no default on it.
  insert into auth.users (id, email) values (v_uid, p_username || '@test.local');
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  select public.create_founder_profile(p_username, p_name, p_country, 'Building things') into v_id;
  return v_id;
end $$;

create or replace function test_boost(p_founder uuid, p_rzp_order text, p_currency text,
                                      p_amount bigint, p_base bigint)
returns jsonb language plpgsql as $$
begin
  insert into public.boost_orders (founder_id, requested_amount, requested_currency, razorpay_order_id)
  values (p_founder, p_amount, p_currency, p_rzp_order);
  return public.award_rank_points('pay_' || p_rzp_order, p_rzp_order, p_currency, p_amount, p_base, now());
end $$;

select test_founder('alex','Alex Morgan','US') as alex \gset
select test_founder('sarah','Sarah Chen','SG') as sarah \gset
select test_founder('aryan','Aryan Sharma','IN') as aryan \gset
select test_founder('rahul','Rahul Verma','IN') as rahul \gset
select test_founder('newbie','New Person','IN') as newbie \gset

\echo '=== TEST 1: INR boost awards 1 RP per rupee ==='
select test_boost(:'aryan', 'order_a1', 'INR', 50000, 50000) ->> 'rank_points' as "aryan Rs.500 -> RP";

\echo '=== TEST 2: USD boost uses Razorpay base_amount (INR), not the USD figure ==='
-- $10 paid; Razorpay reports base_amount of Rs.880 = 88000 paise
select test_boost(:'alex', 'order_a2', 'USD', 1000, 88000) ->> 'rank_points' as "alex $10 -> RP (expect 880)";

\echo '=== TEST 3: duplicate webhook delivery is a no-op (idempotency) ==='
select public.award_rank_points('pay_order_a1','order_a1','INR',50000,50000,now()) ->> 'status' as "replay status (expect ALREADY_PROCESSED)";
select total_rank_points as "aryan total after replay (expect 500)" from public.profiles where username='aryan';

\echo '=== TEST 4: unknown order is rejected ==='
select public.award_rank_points('pay_ghost','order_ghost','INR',10000,10000,now()) ->> 'status' as "ghost order (expect UNKNOWN_ORDER)";

\echo '=== TEST 5: tie-break - equal scores, earlier arrival ranks higher ==='
select test_boost(:'sarah','order_a3','INR',50000,50000) ->> 'new_global_rank' as "sarah ties aryan at 500, gets rank";
select rank, username, points from public.leaderboard_all_time(null, 10, 0);

\echo '=== TEST 6: country leaderboard ==='
select test_boost(:'rahul','order_a4','INR',20000,20000) ->> 'rank_points' as "rahul Rs.200";
select rank, username, points from public.leaderboard_all_time('IN', 10, 0);

\echo '=== TEST 7: unranked founder is excluded and has null rank ==='
select count(*) as "leaderboard rows (newbie excluded, expect 4)" from public.leaderboard_all_time(null, 50, 0);
select global_rank as "newbie global rank (expect null)", total_points from public.founder_ranks(:'newbie');

\echo '=== TEST 8: next_rank_gap - RP needed to take the next spot ==='
select global_gap as "rahul gap to next global", global_target_rank, country_gap as "gap to next in IN", country_target_rank
  from public.next_rank_gap(:'rahul');

\echo '=== TEST 9: Today leaderboard ==='
select rank, username, points from public.leaderboard_today(null, 10, 0);
select today_global_rank, today_country_rank, today_points from public.founder_ranks(:'aryan');

\echo '=== TEST 10: forced refund claws points back and ledgers it ==='
select public.revoke_rank_points('pay_order_a2','REFUND','Bank forced refund') ->> 'points' as "alex points revoked";
select total_rank_points as "alex total after refund (expect 0)" from public.profiles where username='alex';
select points, type, reason from public.rank_ledger where founder_id = :'alex' order by created_at;
select status as "payment row kept, status" from public.payments where razorpay_payment_id='pay_order_a2';
select count(*) as "alex on leaderboard now (expect 0)" from public.leaderboard_all_time(null,50,0) where username='alex';

\echo '=== TEST 11: double refund is a no-op ==='
select public.revoke_rank_points('pay_order_a2','REFUND') ->> 'status' as "expect ALREADY_REVERSED";

\echo '=== TEST 12: today score also reduced by the refund ==='
select points as "alex today points (expect 0)" from public.daily_scores where founder_id = :'alex';

\echo '=== TEST 13: rounding down - Rs.100.99 equivalent gives 100 RP ==='
select test_boost(:'newbie','order_a5','USD',115,10099) ->> 'rank_points' as "expect 100";

\echo '=== TEST 14: reserved + duplicate usernames are blocked ==='
select public.username_available('admin') as "admin available (expect f)",
       public.username_available('aryan') as "aryan available (expect f)",
       public.username_available('ok_name9') as "ok_name9 available (expect t)",
       public.username_available('ab') as "too short (expect f)";

\echo '=== TEST 15: venture cap of 5 ==='
do $$
declare v_f uuid; i int;
begin
  select id into v_f from public.profiles where username='aryan';
  for i in 1..5 loop
    insert into public.ventures (founder_id, type, name) values (v_f, 'PROJECT', 'Project ' || i);
  end loop;
  begin
    insert into public.ventures (founder_id, type, name) values (v_f, 'PROJECT', 'Project 6');
    raise notice 'FAIL: 6th venture was allowed';
  exception when others then
    raise notice 'OK: 6th venture rejected (%)', sqlerrm;
  end;
end $$;

\echo '=== TEST 16: country change cooldown ==='
do $$
declare v_uid uuid;
begin
  select auth_user_id into v_uid from public.profiles where username='rahul';
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform public.change_country('AE');
  raise notice 'OK: first change to AE allowed';
  begin
    perform public.change_country('US');
    raise notice 'FAIL: second change allowed';
  exception when others then
    raise notice 'OK: second change blocked (%)', sqlerrm;
  end;
end $$;

\echo '=== TEST 17: search finds by name, username and venture ==='
select username from public.search_founders('Project 1', null, 10);
select username from public.search_founders('chen', null, 10);

\echo '=== TEST 18: activity feed is populated ==='
select type, count(*) from public.activity_events group by type order by 1;
