-- FounderUp - privacy and validation hardening
--
-- Closes the database half of the launch review:
--
--   * Private profile columns (auth_user_id, is_admin, country change metadata)
--     were readable by anyone holding the anon key. Reads are now granted
--     column by column, so a column added later stays private until someone
--     decides otherwise.
--   * founder_stats(uuid) was executable by anyone for any founder, which the
--     privacy policy says cannot happen. (As written it also failed for every
--     caller - it read tables no client role may see - so the dashboard only
--     ever showed zeros.) Stats are now scoped to the caller.
--   * Direct PostgREST writes skipped the app's http/https URL validation, and
--     change_country accepted any two capital letters plus a caller-chosen
--     cooldown. The database now enforces all of it, whichever path a write
--     takes.

-- ---------------------------------------------------------------------------
-- Resolving the caller
--
-- Policies used to find the caller's profile with a subquery on
-- profiles.auth_user_id. Once that column is private the subquery itself is
-- refused, so the lookup moves into SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
create or replace function public.current_founder_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

-- The caller's own row, private columns included. This is the only way a
-- client can read auth_user_id, is_admin or country_changed_at - and only its
-- own.
create or replace function public.current_profile()
returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- profiles: public columns only
--
-- src/lib/profile-columns.ts mirrors this list. Asking for any other column as
-- anon or authenticated - including select=* - is a permission error.
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (
  id, username, full_name, avatar_url, headline, bio, country_code,
  website_url, x_url, linkedin_url, github_url, contact_type, contact_value,
  total_rank_points, rank_reached_at,
  founder_number, is_early_founder, is_ranked,
  is_verified, is_suspended, created_at, updated_at
) on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies that looked the caller up through profiles.auth_user_id
-- ---------------------------------------------------------------------------
drop policy if exists "active ventures are publicly readable" on public.ventures;
create policy "active ventures are publicly readable"
  on public.ventures for select
  using (status = 'ACTIVE' or founder_id = (select public.current_founder_id()));

drop policy if exists "founders insert their own ventures" on public.ventures;
create policy "founders insert their own ventures"
  on public.ventures for insert
  with check (founder_id = (select public.current_founder_id()));

drop policy if exists "founders update their own ventures" on public.ventures;
create policy "founders update their own ventures"
  on public.ventures for update
  using (founder_id = (select public.current_founder_id()))
  with check (founder_id = (select public.current_founder_id()));

drop policy if exists "founders delete their own ventures" on public.ventures;
create policy "founders delete their own ventures"
  on public.ventures for delete
  using (founder_id = (select public.current_founder_id()));

drop policy if exists "founders read their own boost orders" on public.boost_orders;
create policy "founders read their own boost orders"
  on public.boost_orders for select
  using (founder_id = (select public.current_founder_id()));

drop policy if exists "founders read their own payments" on public.payments;
create policy "founders read their own payments"
  on public.payments for select
  using (founder_id = (select public.current_founder_id()));

drop policy if exists "founders read their own ledger" on public.rank_ledger;
create policy "founders read their own ledger"
  on public.rank_ledger for select
  using (founder_id = (select public.current_founder_id()));

drop policy if exists "authenticated founders file reports" on public.reports;
create policy "authenticated founders file reports"
  on public.reports for insert
  with check (reporter_id = (select public.current_founder_id()));

drop policy if exists "founders read their own reports" on public.reports;
create policy "founders read their own reports"
  on public.reports for select
  using (reporter_id = (select public.current_founder_id()));

-- ---------------------------------------------------------------------------
-- Public rank functions run as the caller, so `select *` on profiles would now
-- be refused. Same logic as 0006, naming only public columns.
-- ---------------------------------------------------------------------------
create or replace function public.founder_ranks(p_founder_id uuid)
returns table (
  global_rank int, country_rank int,
  today_global_rank int, today_country_rank int,
  total_points bigint, today_points bigint, country_code text,
  is_ranked boolean, founder_number bigint, is_early_founder boolean
)
language sql stable as $$
  with me as (
    select p.country_code, p.total_rank_points, p.rank_reached_at,
           p.is_ranked, p.founder_number, p.is_early_founder
      from public.profiles p
     where p.id = p_founder_id
  ),
  today as (
    select coalesce(points, 0) as points, updated_at
      from public.daily_scores
     where founder_id = p_founder_id
       and date_utc = (now() at time zone 'utc')::date
  )
  select
    public.global_rank_of(me.total_rank_points, me.rank_reached_at, me.is_ranked),
    public.country_rank_of(me.country_code, me.total_rank_points, me.rank_reached_at, me.is_ranked),
    case when coalesce((select points from today), 0) <= 0 then null else (
      select count(*)::int + 1 from public.daily_scores d
        join public.profiles p on p.id = d.founder_id
       where d.date_utc = (now() at time zone 'utc')::date
         and p.is_suspended = false
         and (d.points > (select points from today)
              or (d.points = (select points from today)
                  and d.updated_at < (select updated_at from today)))
    ) end,
    case when coalesce((select points from today), 0) <= 0 then null else (
      select count(*)::int + 1 from public.daily_scores d
        join public.profiles p on p.id = d.founder_id
       where d.date_utc = (now() at time zone 'utc')::date
         and p.is_suspended = false
         and p.country_code = me.country_code
         and (d.points > (select points from today)
              or (d.points = (select points from today)
                  and d.updated_at < (select updated_at from today)))
    ) end,
    me.total_rank_points,
    coalesce((select points from today), 0),
    me.country_code,
    me.is_ranked,
    me.founder_number,
    me.is_early_founder
  from me;
$$;

create or replace function public.next_rank_gap(p_founder_id uuid)
returns table (global_gap bigint, global_target_rank int, country_gap bigint, country_target_rank int)
language sql stable as $$
  with me as (
    select p.id, p.country_code, p.total_rank_points, p.rank_reached_at
      from public.profiles p
     where p.id = p_founder_id and p.is_ranked
  ),
  g as (
    select p.total_rank_points as pts
      from public.profiles p, me
     where p.is_suspended = false and p.is_ranked = true and p.id <> me.id
       and (p.total_rank_points > me.total_rank_points
            or (p.total_rank_points = me.total_rank_points and p.rank_reached_at < me.rank_reached_at))
     order by p.total_rank_points asc
     limit 1
  ),
  c as (
    select p.total_rank_points as pts
      from public.profiles p, me
     where p.is_suspended = false and p.is_ranked = true and p.id <> me.id
       and p.country_code = me.country_code
       and (p.total_rank_points > me.total_rank_points
            or (p.total_rank_points = me.total_rank_points and p.rank_reached_at < me.rank_reached_at))
     order by p.total_rank_points asc
     limit 1
  )
  select
    (select greatest(g.pts - me.total_rank_points + 1, 1) from g, me),
    (select count(*)::int + 1 from public.profiles p
      where p.is_suspended = false and p.is_ranked = true
        and p.total_rank_points > (select pts from g)),
    (select greatest(c.pts - me.total_rank_points + 1, 1) from c, me),
    (select count(*)::int + 1 from public.profiles p, me
      where p.is_suspended = false and p.is_ranked = true
        and p.country_code = me.country_code
        and p.total_rank_points > (select pts from c));
$$;

-- ---------------------------------------------------------------------------
-- Reach statistics belong to the founder they describe (plan §55)
-- ---------------------------------------------------------------------------
drop function if exists public.founder_stats(uuid);

create or replace function public.my_founder_stats()
returns table (profile_views bigint, website_clicks bigint, connect_clicks bigint)
language sql stable security definer set search_path = public as $$
  with me as (select public.current_founder_id() as id)
  select
    (select count(*) from public.profile_views v
      where v.founder_id = (select id from me)),
    (select count(*) from public.click_events c
      where c.founder_id = (select id from me) and c.link_type = 'WEBSITE'),
    (select count(*) from public.click_events c
      where c.founder_id = (select id from me)
        and c.link_type in ('CONNECT','X','LINKEDIN','EMAIL','GITHUB'));
$$;

-- ---------------------------------------------------------------------------
-- Links: http/https only (plan §49), whichever path writes them
--
-- Mirrors safeExternalUrl() in src/lib/validation.ts: an http or https scheme,
-- a host containing a dot, no whitespace or control characters, and at most
-- 300 characters. Anything else - javascript:, data:, a bare word - is refused.
-- ---------------------------------------------------------------------------
create or replace function public.is_http_url(p_url text)
returns boolean
language sql immutable parallel safe as $$
  select p_url is null or (
    char_length(p_url) <= 300
    and p_url !~ '[[:space:][:cntrl:]]'
    and p_url ~* '^https?://([^/?#@]*@)?[^/?#@:]+\.[^/?#@:]+(:[0-9]{1,5})?([/?#].*)?$'
  );
$$;

create or replace function public.is_contact_email(p_value text)
returns boolean
language sql immutable parallel safe as $$
  select p_value is not null
     and char_length(p_value) <= 254
     and p_value ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$';
$$;

-- Anything failing these checks could only have arrived by bypassing the app,
-- and none of it is safe to render as a link, so it is dropped rather than kept.
update public.profiles
   set website_url  = case when public.is_http_url(website_url)  then website_url  end,
       x_url        = case when public.is_http_url(x_url)        then x_url        end,
       linkedin_url = case when public.is_http_url(linkedin_url) then linkedin_url end,
       github_url   = case when public.is_http_url(github_url)   then github_url   end,
       avatar_url   = case when public.is_http_url(avatar_url)   then avatar_url   end
 where not (public.is_http_url(website_url) and public.is_http_url(x_url)
            and public.is_http_url(linkedin_url) and public.is_http_url(github_url)
            and public.is_http_url(avatar_url));

update public.ventures
   set url      = case when public.is_http_url(url)      then url      end,
       logo_url = case when public.is_http_url(logo_url) then logo_url end
 where not (public.is_http_url(url) and public.is_http_url(logo_url));

-- contact_value is an email, and only when contact_type is EMAIL - which is
-- what the settings form writes. Older rows carried the website URL here; the
-- Connect button never read it, and the settings form rejected it as an email.
update public.profiles
   set contact_value = null
 where contact_type <> 'EMAIL' and contact_value is not null;

update public.profiles
   set contact_type = 'WEBSITE', contact_value = null
 where contact_type = 'EMAIL' and not public.is_contact_email(contact_value);

alter table public.profiles
  drop constraint if exists profiles_website_url_http,
  drop constraint if exists profiles_x_url_http,
  drop constraint if exists profiles_linkedin_url_http,
  drop constraint if exists profiles_github_url_http,
  drop constraint if exists profiles_avatar_url_http,
  drop constraint if exists profiles_contact_value_valid,
  add constraint profiles_website_url_http  check (public.is_http_url(website_url)),
  add constraint profiles_x_url_http        check (public.is_http_url(x_url)),
  add constraint profiles_linkedin_url_http check (public.is_http_url(linkedin_url)),
  add constraint profiles_github_url_http   check (public.is_http_url(github_url)),
  add constraint profiles_avatar_url_http   check (public.is_http_url(avatar_url)),
  add constraint profiles_contact_value_valid check (
    case when contact_type = 'EMAIL' then public.is_contact_email(contact_value)
         else contact_value is null
    end
  );

alter table public.ventures
  drop constraint if exists ventures_url_http,
  drop constraint if exists ventures_logo_url_http,
  add constraint ventures_url_http      check (public.is_http_url(url)),
  add constraint ventures_logo_url_http check (public.is_http_url(logo_url));

-- ---------------------------------------------------------------------------
-- Countries: a real list, not "two capital letters"
--
-- The same 221 ISO 3166-1 codes as src/lib/countries.ts. e2e/contracts.spec.ts
-- fails if the two lists drift apart.
-- ---------------------------------------------------------------------------
create table if not exists public.countries (
  code text primary key constraint countries_code_format check (code ~ '^[A-Z]{2}$')
);

insert into public.countries (code) values
  ('AD'), ('AE'), ('AF'), ('AG'), ('AI'), ('AL'), ('AM'), ('AO'), ('AR'), ('AT'), ('AU'), ('AW'),
  ('AZ'), ('BA'), ('BB'), ('BD'), ('BE'), ('BF'), ('BG'), ('BH'), ('BI'), ('BJ'), ('BM'), ('BN'),
  ('BO'), ('BR'), ('BS'), ('BT'), ('BW'), ('BY'), ('BZ'), ('CA'), ('CD'), ('CF'), ('CG'), ('CH'),
  ('CI'), ('CL'), ('CM'), ('CN'), ('CO'), ('CR'), ('CU'), ('CV'), ('CW'), ('CY'), ('CZ'), ('DE'),
  ('DJ'), ('DK'), ('DM'), ('DO'), ('DZ'), ('EC'), ('EE'), ('EG'), ('ER'), ('ES'), ('ET'), ('FI'),
  ('FJ'), ('FM'), ('FO'), ('FR'), ('GA'), ('GB'), ('GD'), ('GE'), ('GF'), ('GG'), ('GH'), ('GI'),
  ('GL'), ('GM'), ('GN'), ('GQ'), ('GR'), ('GT'), ('GU'), ('GW'), ('GY'), ('HK'), ('HN'), ('HR'),
  ('HT'), ('HU'), ('ID'), ('IE'), ('IL'), ('IM'), ('IN'), ('IQ'), ('IR'), ('IS'), ('IT'), ('JE'),
  ('JM'), ('JO'), ('JP'), ('KE'), ('KG'), ('KH'), ('KI'), ('KM'), ('KN'), ('KP'), ('KR'), ('KW'),
  ('KY'), ('KZ'), ('LA'), ('LB'), ('LC'), ('LI'), ('LK'), ('LR'), ('LS'), ('LT'), ('LU'), ('LV'),
  ('LY'), ('MA'), ('MC'), ('MD'), ('ME'), ('MG'), ('MH'), ('MK'), ('ML'), ('MM'), ('MN'), ('MO'),
  ('MQ'), ('MR'), ('MT'), ('MU'), ('MV'), ('MW'), ('MX'), ('MY'), ('MZ'), ('NA'), ('NC'), ('NE'),
  ('NG'), ('NI'), ('NL'), ('NO'), ('NP'), ('NR'), ('NZ'), ('OM'), ('PA'), ('PE'), ('PF'), ('PG'),
  ('PH'), ('PK'), ('PL'), ('PR'), ('PS'), ('PT'), ('PW'), ('PY'), ('QA'), ('RE'), ('RO'), ('RS'),
  ('RU'), ('RW'), ('SA'), ('SB'), ('SC'), ('SD'), ('SE'), ('SG'), ('SI'), ('SK'), ('SL'), ('SM'),
  ('SN'), ('SO'), ('SR'), ('SS'), ('ST'), ('SV'), ('SX'), ('SY'), ('SZ'), ('TC'), ('TD'), ('TG'),
  ('TH'), ('TJ'), ('TL'), ('TM'), ('TN'), ('TO'), ('TR'), ('TT'), ('TV'), ('TW'), ('TZ'), ('UA'),
  ('UG'), ('US'), ('UY'), ('UZ'), ('VA'), ('VC'), ('VE'), ('VG'), ('VI'), ('VN'), ('VU'), ('WS'),
  ('XK'), ('YE'), ('ZA'), ('ZM'), ('ZW')
on conflict (code) do nothing;

alter table public.countries enable row level security;
drop policy if exists "countries are public" on public.countries;
create policy "countries are public" on public.countries for select using (true);
revoke all on public.countries from anon, authenticated;
grant select on public.countries to anon, authenticated;

-- Covers every path that can write a country: onboarding, change_country, the
-- service role, a psql session.
alter table public.profiles
  drop constraint if exists profiles_country_code_fkey,
  add constraint profiles_country_code_fkey
    foreign key (country_code) references public.countries (code);

-- ---------------------------------------------------------------------------
-- change_country (plan §30)
--
-- The cooldown used to be a parameter, so a direct RPC call could pass 0 and
-- change country at will. It now lives beside the check it enforces;
-- COUNTRY_CHANGE_COOLDOWN_DAYS in src/lib/config.ts mirrors it for copy only.
-- ---------------------------------------------------------------------------
drop function if exists public.change_country(text, int);

create or replace function public.change_country(p_country_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_cooldown constant interval := interval '30 days';
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Locked, so two concurrent changes cannot both pass the cooldown check.
  select * into v_profile from public.profiles where auth_user_id = v_uid for update;
  if not found then raise exception 'NO_PROFILE'; end if;

  p_country_code := upper(trim(p_country_code));
  if not exists (select 1 from public.countries where code = p_country_code) then
    raise exception 'COUNTRY_INVALID';
  end if;
  if p_country_code = v_profile.country_code then return; end if;

  if v_profile.country_changed_at is not null
     and v_profile.country_changed_at > now() - v_cooldown then
    raise exception 'COUNTRY_COOLDOWN';
  end if;

  update public.profiles
     set country_code = p_country_code, country_changed_at = now()
   where id = v_profile.id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (v_profile.id, 'COUNTRY_CHANGED', 'profile', v_profile.id::text,
          jsonb_build_object('from', v_profile.country_code, 'to', p_country_code));
end;
$$;

-- ---------------------------------------------------------------------------
-- create_founder_profile: every input checked before a number is drawn
--
-- nextval() is never rolled back, so an insert that fails after drawing a
-- number burns that number for good. 0006 checked the username up front but
-- left the name, headline and country to table constraints, which let anyone
-- with a session burn Early Founder numbers by calling this RPC directly with
-- a bad value. The only insert failure left is a lost username race.
-- ---------------------------------------------------------------------------
create or replace function public.create_founder_profile(
  p_username text,
  p_full_name text,
  p_country_code text,
  p_headline text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_number bigint;
  v_early boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Serialise concurrent completions by the same user (see 0006).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_existing from public.profiles where auth_user_id = v_uid;
  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'founder_number', v_existing.founder_number,
      'is_early_founder', v_existing.is_early_founder,
      'is_ranked', v_existing.is_ranked,
      'created', false
    );
  end if;

  p_username := lower(trim(p_username));
  if p_username is null or p_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'USERNAME_INVALID';
  end if;
  if public.is_reserved_username(p_username) then
    raise exception 'USERNAME_RESERVED';
  end if;
  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'USERNAME_TAKEN';
  end if;

  p_full_name := trim(p_full_name);
  if p_full_name is null or char_length(p_full_name) not between 1 and 60 then
    raise exception 'NAME_INVALID';
  end if;

  p_headline := nullif(trim(p_headline), '');
  if char_length(p_headline) > 80 then
    raise exception 'HEADLINE_INVALID';
  end if;

  p_country_code := upper(trim(p_country_code));
  if not exists (select 1 from public.countries where code = p_country_code) then
    raise exception 'COUNTRY_INVALID';
  end if;

  begin
    insert into public.profiles (
      auth_user_id, username, full_name, country_code, headline
    )
    values (v_uid, p_username, p_full_name, p_country_code, p_headline)
    returning id, founder_number, is_early_founder
      into v_id, v_number, v_early;
  exception
    when unique_violation then
      -- Last-resort guard if the advisory lock was somehow bypassed.
      select * into v_existing from public.profiles where auth_user_id = v_uid;
      if found then
        return jsonb_build_object(
          'id', v_existing.id,
          'founder_number', v_existing.founder_number,
          'is_early_founder', v_existing.is_early_founder,
          'is_ranked', v_existing.is_ranked,
          'created', false
        );
      end if;
      raise exception 'USERNAME_TAKEN';
  end;

  insert into public.activity_events (founder_id, type, metadata)
  values (
    v_id, 'JOINED',
    jsonb_build_object('founder_number', v_number, 'is_early_founder', v_early)
  );

  return jsonb_build_object(
    'id', v_id,
    'founder_number', v_number,
    'is_early_founder', v_early,
    'is_ranked', v_early,
    'created', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
--
-- Supabase grants EXECUTE on new functions to every API role by default, so
-- each one is narrowed explicitly. is_http_url and is_contact_email keep the
-- default: every role that writes a checked column has to be able to run them.
-- ---------------------------------------------------------------------------

-- The ventures read policy calls this for every reader, anon included. It only
-- ever reveals the caller's own id.
revoke all on function public.current_founder_id() from public;
grant execute on function public.current_founder_id() to anon, authenticated, service_role;

revoke all on function public.current_profile() from public, anon;
grant execute on function public.current_profile() to authenticated, service_role;

revoke all on function public.my_founder_stats() from public, anon;
grant execute on function public.my_founder_stats() to authenticated, service_role;

revoke all on function public.change_country(text) from public, anon;
grant execute on function public.change_country(text) to authenticated;

revoke all on function public.create_founder_profile(text, text, text, text) from public, anon;
grant execute on function public.create_founder_profile(text, text, text, text) to authenticated;
