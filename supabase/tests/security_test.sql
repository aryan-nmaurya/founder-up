-- FounderUp - privacy and validation tests (migration 0007)
--
-- Every check runs as the role that would really make the request - anon or
-- authenticated - because what those roles can do is the thing under test.
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

-- Runs p_sql as the current role; passes if it succeeds.
create or replace function test_allowed(p_label text, p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return test_check(p_label, true);
exception when others then
  return test_check(p_label, false, 'refused: ' || sqlerrm);
end $$;

-- Runs p_sql as the current role; passes if it fails with a matching error.
create or replace function test_refused(p_label text, p_sql text, p_error_like text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return test_check(p_label, false, 'was allowed');
exception when others then
  return test_check(p_label, sqlerrm like p_error_like, sqlerrm);
end $$;

-- A founder created the way onboarding creates one.
create or replace function test_sec_founder(p_username text, p_country text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_uid, p_username || '@test.local');
  perform set_config('request.jwt.claim.sub', v_uid::text, false);
  perform public.create_founder_profile(p_username, initcap(p_username), p_country, null);
  return v_uid;
end $$;

select test_sec_founder('ada', 'IN') as ada_uid \gset
select test_sec_founder('ben', 'US') as ben_uid \gset
select id as ada from public.profiles where username = 'ada' \gset
select id as ben from public.profiles where username = 'ben' \gset

-- A captured payment for ada, and some reach for both.
insert into public.boost_orders (founder_id, requested_amount, requested_currency, razorpay_order_id)
values (:'ada', 10000, 'INR', 'order_sec_1');
select test_check('fixture payment awarded',
  public.award_rank_points('pay_sec_1', 'order_sec_1', 'INR', 10000, 10000, now()) ->> 'status' = 'AWARDED');
insert into public.profile_views (founder_id, visitor_hash)
values (:'ada', 'v1'), (:'ada', 'v2'), (:'ben', 'v1');
insert into public.click_events (founder_id, link_type)
values (:'ada', 'WEBSITE'), (:'ada', 'CONNECT'), (:'ben', 'X');


\echo ''
\echo '--- anon: public columns only (blocker 4)'
set role anon;
set "request.jwt.claim.sub" = '';
select test_allowed('anon reads every public profile column',
  'select id, username, full_name, avatar_url, headline, bio, country_code,
          website_url, x_url, linkedin_url, github_url, contact_type, contact_value,
          total_rank_points, rank_reached_at, founder_number, is_early_founder,
          is_ranked, is_verified, is_suspended, created_at, updated_at
     from public.profiles');
select test_refused('anon reads auth_user_id', 'select auth_user_id from public.profiles', '%permission denied%');
select test_refused('anon reads is_admin', 'select is_admin from public.profiles', '%permission denied%');
select test_refused('anon reads country_changed_at', 'select country_changed_at from public.profiles', '%permission denied%');
select test_refused('anon reads profile_completed_at', 'select profile_completed_at from public.profiles', '%permission denied%');
select test_refused('anon selects every column', 'select * from public.profiles', '%permission denied%');
select test_refused('anon filters on auth_user_id',
  'select id from public.profiles where auth_user_id is not null', '%permission denied%');
select test_allowed('anon reads the all-time board', 'select * from public.leaderboard_all_time(null, 10, 0)');
select test_allowed('anon reads the today board', 'select * from public.leaderboard_today(null, 10, 0)');
select test_allowed('anon reads founder ranks', format('select * from public.founder_ranks(%L)', :'ada'));
select test_allowed('anon reads the next rank gap', format('select * from public.next_rank_gap(%L)', :'ada'));
select test_allowed('anon searches founders', $q$select * from public.search_founders('ad', null, 10)$q$);
select test_allowed('anon reads active ventures', 'select * from public.ventures');
select test_allowed('anon reads the early founder counter', 'select * from public.early_founder_status()');
select test_refused('anon reads reach stats (blocker 5)', 'select * from public.my_founder_stats()', '%permission denied%');
select test_refused('anon reads a private row', 'select * from public.current_profile()', '%permission denied%');
select test_refused('anon changes a country', $q$select public.change_country('GB')$q$, '%permission denied%');
reset role;
select test_check('founder_stats(uuid) is gone', not exists (select 1 from pg_proc where proname = 'founder_stats'));


\echo ''
\echo '--- a signed-in founder sees private columns for their own row only'
set role authenticated;
set "request.jwt.claim.sub" = :'ada_uid';
select test_refused('founder reads auth_user_id directly', 'select auth_user_id from public.profiles', '%permission denied%');
select test_check('current_profile returns exactly the caller',
  (select count(*) = 1 and bool_and(username = 'ada') from public.current_profile()));
select test_check('current_profile includes private columns',
  (select auth_user_id::text = :'ada_uid' and is_admin = false from public.current_profile()));
select test_check('current_founder_id is the caller', public.current_founder_id() = :'ada'::uuid);
select test_check('own reach stats',
  (select profile_views = 2 and website_clicks = 1 and connect_clicks = 1 from public.my_founder_stats()));
set "request.jwt.claim.sub" = :'ben_uid';
select test_check('another founder gets only their own stats',
  (select profile_views = 1 and website_clicks = 0 and connect_clicks = 1 from public.my_founder_stats()));


\echo ''
\echo '--- policies still resolve the caller without reading auth_user_id'
set "request.jwt.claim.sub" = :'ada_uid';
select test_check('founder reads own payment', (select count(*) from public.payments) = 1);
select test_check('founder reads own ledger', (select count(*) from public.rank_ledger) = 1);
select test_check('founder reads own boost order', (select count(*) from public.boost_orders) = 1);
select test_allowed('founder adds own venture', format(
  $q$insert into public.ventures (founder_id, type, name, url) values (%L, 'PROJECT', 'Ada Labs', 'https://adalabs.dev/')$q$, :'ada'));
select test_refused('founder adds a venture for someone else', format(
  $q$insert into public.ventures (founder_id, type, name) values (%L, 'PROJECT', 'Not mine')$q$, :'ben'), '%row-level security%');
select test_allowed('founder hides own venture', $q$update public.ventures set status = 'HIDDEN' where name = 'Ada Labs'$q$);
select test_check('founder still sees own hidden venture', (select count(*) from public.ventures where name = 'Ada Labs') = 1);
select test_allowed('founder files a report', format(
  $q$insert into public.reports (reporter_id, profile_id, reason) values (%L, %L, 'SPAM')$q$, :'ada', :'ben'));
select test_refused('founder files a report as someone else', format(
  $q$insert into public.reports (reporter_id, profile_id, reason) values (%L, %L, 'SPAM')$q$, :'ben', :'ada'), '%row-level security%');
set "request.jwt.claim.sub" = :'ben_uid';
select test_check('other founders'' payments stay private', (select count(*) from public.payments) = 0);
select test_check('other founders'' hidden ventures stay hidden', (select count(*) from public.ventures where name = 'Ada Labs') = 0);
select test_check('other founders'' reports stay private', (select count(*) from public.reports) = 0);


\echo ''
\echo '--- score and identity columns stay out of reach'
set "request.jwt.claim.sub" = :'ada_uid';
select test_refused('founder writes own score', format(
  'update public.profiles set total_rank_points = 999999 where id = %L', :'ada'), '%permission denied%');
select test_refused('founder makes self admin', format(
  'update public.profiles set is_admin = true where id = %L', :'ada'), '%permission denied%');
select test_refused('founder ranks self', format(
  'update public.profiles set is_ranked = true where id = %L', :'ada'), '%permission denied%');
select test_refused('founder changes country around the RPC', format(
  $q$update public.profiles set country_code = 'GB' where id = %L$q$, :'ada'), '%permission denied%');


\echo ''
\echo '--- links are http(s) only, whichever path writes them (blocker 6)'
select test_allowed('https website', format(
  $q$update public.profiles set website_url = 'https://ada.dev/' where id = %L$q$, :'ada'));
select test_refused('javascript: website', format(
  $q$update public.profiles set website_url = 'javascript:alert(1)' where id = %L$q$, :'ada'), '%profiles_website_url_http%');
select test_refused('data: avatar', format(
  $q$update public.profiles set avatar_url = 'data:image/svg+xml,<svg onload=alert(1)>' where id = %L$q$, :'ada'), '%profiles_avatar_url_http%');
select test_refused('link without a real host', format(
  $q$update public.profiles set x_url = 'https://localhost/ada' where id = %L$q$, :'ada'), '%profiles_x_url_http%');
select test_refused('link containing whitespace', format(
  $q$update public.profiles set linkedin_url = 'https://linkedin.com/in/ada lovelace' where id = %L$q$, :'ada'), '%profiles_linkedin_url_http%');
select test_refused('ftp link', format(
  $q$update public.profiles set github_url = 'ftp://github.com/ada' where id = %L$q$, :'ada'), '%profiles_github_url_http%');
select test_refused('javascript: venture link', format(
  $q$insert into public.ventures (founder_id, type, name, url) values (%L, 'PROJECT', 'Bad', 'javascript:alert(1)')$q$, :'ada'), '%ventures_url_http%');
select test_refused('data: venture logo', format(
  $q$insert into public.ventures (founder_id, type, name, logo_url) values (%L, 'PROJECT', 'Bad', 'data:image/png;base64,AAAA')$q$, :'ada'), '%ventures_logo_url_http%');
select test_refused('venture link edited to javascript:',
  $q$update public.ventures set url = 'javascript:alert(1)' where name = 'Ada Labs'$q$, '%ventures_url_http%');
select test_refused('email contact that is not an email', format(
  $q$update public.profiles set contact_type = 'EMAIL', contact_value = 'not-an-email' where id = %L$q$, :'ada'), '%profiles_contact_value_valid%');
select test_allowed('email contact', format(
  $q$update public.profiles set contact_type = 'EMAIL', contact_value = 'ada@ada.dev' where id = %L$q$, :'ada'));
select test_refused('contact value stashed on a non-email type', format(
  $q$update public.profiles set contact_type = 'WEBSITE', contact_value = 'anything at all' where id = %L$q$, :'ada'), '%profiles_contact_value_valid%');
reset role;
select test_check('is_http_url accepts real links', bool_and(public.is_http_url(u)))
  from (values ('https://example.com/'), ('http://sub.example.co.in/p?q=1#x'),
               ('https://example.com:8080/'), ('HTTPS://EXAMPLE.COM/'),
               ('https://user:pw@example.com/'),
               ('http://127.0.0.1:54321/storage/v1/object/public/media/a.png')) v(u);
select test_check('is_http_url refuses everything else', not bool_or(public.is_http_url(u)))
  from (values ('javascript:alert(1)'), ('JaVaScRiPt:alert(1)'), ('data:text/html,hi'),
               ('vbscript:x'), ('https://localhost/'), ('ftp://example.com/'),
               ('//example.com/'), ('example.com'), ('https://exa mple.com/'),
               ('https://example.com/' || repeat('a', 300))) v(u);


\echo ''
\echo '--- countries come from the real list (blocker 6)'
select test_check('221 countries seeded', (select count(*) from public.countries) = 221);
set role authenticated;
set "request.jwt.claim.sub" = :'ben_uid';
select test_refused('change country to ZZ', $q$select public.change_country('ZZ')$q$, '%COUNTRY_INVALID%');
select test_refused('pass the cooldown as a parameter', $q$select public.change_country('GB', 0)$q$, '%does not exist%');
select test_allowed('change country to gb', $q$select public.change_country('gb')$q$);
select test_refused('change again inside the cooldown', $q$select public.change_country('FR')$q$, '%COUNTRY_COOLDOWN%');
reset role;
select test_check('country recorded as GB', (select country_code = 'GB' from public.profiles where username = 'ben'));
select test_refused('service role writes country ZZ', format(
  $q$update public.profiles set country_code = 'ZZ' where id = %L$q$, :'ada'), '%profiles_country_code_fkey%');


\echo ''
\echo '--- a rejected onboarding call never burns a founder number'
select last_value as seq_before from pg_sequences
 where schemaname = 'public' and sequencename = 'founder_number_seq' \gset
insert into auth.users (id, email) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cy@test.local');
set role authenticated;
set "request.jwt.claim.sub" = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select test_refused('onboard with country ZZ',
  $q$select public.create_founder_profile('cyfounder', 'Cy', 'ZZ', null)$q$, '%COUNTRY_INVALID%');
select test_refused('onboard with a 61-character name',
  $q$select public.create_founder_profile('cyfounder', repeat('x', 61), 'IN', null)$q$, '%NAME_INVALID%');
select test_refused('onboard with a blank name',
  $q$select public.create_founder_profile('cyfounder', '   ', 'IN', null)$q$, '%NAME_INVALID%');
select test_refused('onboard with an 81-character headline',
  $q$select public.create_founder_profile('cyfounder', 'Cy', 'IN', repeat('x', 81))$q$, '%HEADLINE_INVALID%');
reset role;
select test_check('rejected calls drew no numbers',
  (select last_value from pg_sequences
    where schemaname = 'public' and sequencename = 'founder_number_seq') = :seq_before);
set role authenticated;
set "request.jwt.claim.sub" = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select test_check('a valid call still onboards',
  public.create_founder_profile('cyfounder', 'Cy', 'in', null) ->> 'created' = 'true');
reset role;

\echo ''
\echo 'Done. Any line beginning FAIL is a failure.'
