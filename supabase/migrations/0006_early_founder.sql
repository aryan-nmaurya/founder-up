-- FounderUp - Early Founder system
--
-- The first 50 founders to complete a public profile get a permanent
-- `founder_number` and free leaderboard eligibility. Numbers are issued by a
-- database sequence, so two concurrent completions can never collide, and a
-- deleted account never frees its number for reuse.
--
-- Note on naming: the spec's `rank_points` is this schema's existing
-- `total_rank_points` column. It is not duplicated.

-- ---------------------------------------------------------------------------
-- The counter
--
-- A sequence is the atomic primitive here. nextval() is non-transactional:
-- concurrent callers are each handed a distinct value with no locking, and a
-- rolled-back insert never hands its number back. That is exactly the
-- behaviour we want - numbers are historical identifiers, not slots.
-- ---------------------------------------------------------------------------
create sequence if not exists public.founder_number_seq as bigint start with 1 increment by 1 no cycle;

-- How many founders get in free. Kept as a function so the value has one home
-- and SQL and TypeScript can't drift apart silently.
create or replace function public.early_founder_limit()
returns int language sql immutable parallel safe as $$ select 50; $$;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists founder_number      bigint,
  add column if not exists is_early_founder    boolean not null default false,
  add column if not exists is_ranked           boolean not null default false,
  add column if not exists profile_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Backfill existing profiles, oldest first, then park the sequence past them.
-- Idempotent: rows that already carry a number are left alone.
-- ---------------------------------------------------------------------------
do $$
declare v_max bigint;
begin
  with ordered as (
    select id,
           row_number() over (order by created_at asc, id asc) as n
      from public.profiles
     where founder_number is null
  )
  update public.profiles p
     set founder_number = ordered.n,
         is_early_founder = ordered.n <= public.early_founder_limit(),
         -- An existing founder is ranked if they were an early founder or had
         -- already paid. No fabricated payments either way.
         is_ranked = (ordered.n <= public.early_founder_limit())
                     or p.total_rank_points > 0,
         profile_completed_at = coalesce(p.profile_completed_at, p.created_at)
    from ordered
   where p.id = ordered.id;

  select coalesce(max(founder_number), 0) into v_max from public.profiles;

  if v_max > 0 then
    perform setval('public.founder_number_seq', v_max, true);
  else
    perform setval('public.founder_number_seq', 1, false);
  end if;
end $$;

alter table public.profiles
  alter column founder_number set default nextval('public.founder_number_seq'),
  alter column founder_number set not null;

alter sequence public.founder_number_seq owned by public.profiles.founder_number;

-- ---------------------------------------------------------------------------
-- Identity is derived by the database, never supplied by a caller.
--
-- Putting this in a BEFORE INSERT trigger means the rules hold for every path
-- that can create a profile - the onboarding RPC, the service role, a seed
-- script, a psql session - not just the one we remembered to write correctly.
-- ---------------------------------------------------------------------------
create or replace function public.assign_founder_identity()
returns trigger language plpgsql as $$
begin
  if new.founder_number is null then
    new.founder_number := nextval('public.founder_number_seq');
  end if;

  new.is_early_founder := new.founder_number <= public.early_founder_limit();

  -- Early Founders are ranked on arrival. Everyone else stays unranked until a
  -- payment captures, whatever the insert asked for.
  new.is_ranked := new.is_early_founder or coalesce(new.is_ranked, false);

  new.profile_completed_at := coalesce(new.profile_completed_at, now());
  return new;
end;
$$;

drop trigger if exists profiles_assign_founder_identity on public.profiles;
create trigger profiles_assign_founder_identity
  before insert on public.profiles
  for each row execute function public.assign_founder_identity();

-- ---------------------------------------------------------------------------
-- Constraints and indexes
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_founder_number_key'
  ) then
    alter table public.profiles
      add constraint profiles_founder_number_key unique (founder_number);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_founder_number_positive'
  ) then
    alter table public.profiles
      add constraint profiles_founder_number_positive check (founder_number > 0);
  end if;

  -- is_early_founder is derived, never independent. This makes a bad write
  -- impossible rather than merely discouraged.
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_early_founder_matches_number'
  ) then
    alter table public.profiles
      add constraint profiles_early_founder_matches_number
      check (is_early_founder = (founder_number <= 50));
  end if;

  -- An early founder is always ranked; that is what the status buys.
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_early_founder_is_ranked'
  ) then
    alter table public.profiles
      add constraint profiles_early_founder_is_ranked
      check (not is_early_founder or is_ranked);
  end if;
end $$;

create index if not exists profiles_founder_number_idx
  on public.profiles (founder_number);

-- Leaderboard reads now gate on is_ranked, so the partial indexes follow.
drop index if exists profiles_rank_idx;
drop index if exists profiles_country_rank_idx;

create index profiles_rank_idx
  on public.profiles (total_rank_points desc, rank_reached_at asc)
  where is_suspended = false and is_ranked = true;

create index profiles_country_rank_idx
  on public.profiles (country_code, total_rank_points desc, rank_reached_at asc)
  where is_suspended = false and is_ranked = true;

-- ---------------------------------------------------------------------------
-- founder_number and its derived flags are immutable once set.
--
-- The column grants in 0004 already keep `authenticated` away from these, so
-- this trigger is the second line: it also stops a mistake made with the
-- service role, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------
create or replace function public.protect_founder_number()
returns trigger language plpgsql as $$
begin
  if new.founder_number is distinct from old.founder_number then
    raise exception 'FOUNDER_NUMBER_IMMUTABLE';
  end if;
  if new.is_early_founder is distinct from old.is_early_founder then
    raise exception 'EARLY_FOUNDER_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_founder_number on public.profiles;
create trigger profiles_protect_founder_number
  before update on public.profiles
  for each row execute function public.protect_founder_number();

-- ---------------------------------------------------------------------------
-- Public availability counter
--
-- Counted from the sequence, not from live rows: a deleted account does not
-- reopen its spot (plan requirement - numbers are never reused), so counting
-- surviving profiles would let the counter drift backwards.
-- ---------------------------------------------------------------------------
create or replace function public.early_founder_status()
returns table (
  claimed int,
  spots int,
  remaining int,
  all_claimed boolean,
  active_early_founders int
)
language sql stable security definer set search_path = public, pg_catalog as $$
  with issued as (
    select coalesce(
      (select s.last_value from pg_sequences s
        where s.schemaname = 'public' and s.sequencename = 'founder_number_seq'),
      0
    ) as highest
  )
  select
    least(issued.highest, public.early_founder_limit())::int,
    public.early_founder_limit(),
    greatest(public.early_founder_limit() - issued.highest, 0)::int,
    issued.highest >= public.early_founder_limit(),
    (select count(*)::int from public.profiles where is_early_founder)
  from issued;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding completion
--
-- This is the only place a founder number is issued, and it is the moment a
-- valid public profile comes into existence. Authenticating alone reaches
-- none of this, so signing in cannot consume a number.
--
-- Idempotent: a retried request returns the profile that already exists
-- without touching the sequence.
-- ---------------------------------------------------------------------------
drop function if exists public.create_founder_profile(text, text, text, text);

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

  -- Serialise concurrent completions by the same user. Without this, two
  -- retries racing would both pass the existence check, both call nextval,
  -- and the loser's number would be burned by the unique(auth_user_id)
  -- violation. Different users never contend for this lock.
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
  if p_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'USERNAME_INVALID';
  end if;
  if public.is_reserved_username(p_username) then
    raise exception 'USERNAME_RESERVED';
  end if;
  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'USERNAME_TAKEN';
  end if;

  -- Everything that can fail has been checked, so the number is drawn as late
  -- as possible. assign_founder_identity() issues it and derives the flags.
  begin
    insert into public.profiles (
      auth_user_id, username, full_name, country_code, headline
    )
    values (
      v_uid, p_username, trim(p_full_name), upper(p_country_code),
      nullif(trim(p_headline), '')
    )
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
-- Ranking now follows is_ranked, not "has points".
--
-- An Early Founder sits on the board at 0 RP; a paid founder joins it the
-- moment their first payment is captured.
-- ---------------------------------------------------------------------------
drop function if exists public.founder_ranks(uuid);
drop function if exists public.global_rank_of(bigint, timestamptz);
drop function if exists public.country_rank_of(text, bigint, timestamptz);

create or replace function public.global_rank_of(
  p_points bigint, p_reached_at timestamptz, p_is_ranked boolean
)
returns int language sql stable as $$
  select case when not coalesce(p_is_ranked, false) then null else (
    select count(*)::int + 1
      from public.profiles p
     where p.is_suspended = false
       and p.is_ranked = true
       and (p.total_rank_points > p_points
            or (p.total_rank_points = p_points and p.rank_reached_at < p_reached_at))
  ) end;
$$;

create or replace function public.country_rank_of(
  p_country text, p_points bigint, p_reached_at timestamptz, p_is_ranked boolean
)
returns int language sql stable as $$
  select case when not coalesce(p_is_ranked, false) then null else (
    select count(*)::int + 1
      from public.profiles p
     where p.is_suspended = false
       and p.is_ranked = true
       and p.country_code = p_country
       and (p.total_rank_points > p_points
            or (p.total_rank_points = p_points and p.rank_reached_at < p_reached_at))
  ) end;
$$;

-- These gain founder_number / is_early_founder columns, so the old signatures
-- have to go first.
drop function if exists public.leaderboard_all_time(text, int, int);
drop function if exists public.leaderboard_today(text, int, int);
drop function if exists public.search_founders(text, text, int);

create or replace function public.leaderboard_all_time(
  p_country text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  rank int, id uuid, username text, full_name text, avatar_url text,
  headline text, country_code text, points bigint, is_verified boolean,
  venture_name text, venture_url text,
  founder_number bigint, is_early_founder boolean
)
language sql stable as $$
  select
    (row_number() over (order by p.total_rank_points desc, p.rank_reached_at asc))::int + p_offset,
    p.id, p.username, p.full_name, p.avatar_url, p.headline, p.country_code,
    p.total_rank_points, p.is_verified, v.name, v.url,
    p.founder_number, p.is_early_founder
  from public.profiles p
  left join lateral (
    select name, url from public.ventures
     where founder_id = p.id and status = 'ACTIVE'
     order by sort_order asc, created_at asc limit 1
  ) v on true
  where p.is_suspended = false
    and p.is_ranked = true
    and (p_country is null or p.country_code = p_country)
  order by p.total_rank_points desc, p.rank_reached_at asc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.leaderboard_today(
  p_country text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  rank int, id uuid, username text, full_name text, avatar_url text,
  headline text, country_code text, points bigint, is_verified boolean,
  venture_name text, venture_url text,
  founder_number bigint, is_early_founder boolean
)
language sql stable as $$
  select
    (row_number() over (order by d.points desc, d.updated_at asc))::int + p_offset,
    p.id, p.username, p.full_name, p.avatar_url, p.headline, p.country_code,
    d.points, p.is_verified, v.name, v.url,
    p.founder_number, p.is_early_founder
  from public.daily_scores d
  join public.profiles p on p.id = d.founder_id
  left join lateral (
    select name, url from public.ventures
     where founder_id = p.id and status = 'ACTIVE'
     order by sort_order asc, created_at asc limit 1
  ) v on true
  where d.date_utc = (now() at time zone 'utc')::date
    and d.points > 0
    and p.is_suspended = false
    and (p_country is null or p.country_code = p_country)
  order by d.points desc, d.updated_at asc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.leaderboard_count(
  p_period text default 'ALL_TIME',
  p_country text default null
)
returns int language sql stable as $$
  select case when p_period = 'TODAY' then (
    select count(*)::int
      from public.daily_scores d
      join public.profiles p on p.id = d.founder_id
     where d.date_utc = (now() at time zone 'utc')::date
       and d.points > 0 and p.is_suspended = false
       and (p_country is null or p.country_code = p_country)
  ) else (
    select count(*)::int
      from public.profiles p
     where p.is_suspended = false and p.is_ranked = true
       and (p_country is null or p.country_code = p_country)
  ) end;
$$;

create or replace function public.founder_ranks(p_founder_id uuid)
returns table (
  global_rank int, country_rank int,
  today_global_rank int, today_country_rank int,
  total_points bigint, today_points bigint, country_code text,
  is_ranked boolean, founder_number bigint, is_early_founder boolean
)
language sql stable as $$
  with me as (select * from public.profiles where id = p_founder_id),
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

-- Only meaningful for a founder already on the board. An unranked founder is
-- shown the "get ranked" minimum instead, which the UI decides.
create or replace function public.next_rank_gap(p_founder_id uuid)
returns table (global_gap bigint, global_target_rank int, country_gap bigint, country_target_rank int)
language sql stable as $$
  with me as (select * from public.profiles where id = p_founder_id and is_ranked),
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

-- Search must know about is_ranked too: an Early Founder sitting at 0 RP is
-- ranked, so "0 points" is no longer a reliable stand-in for "unranked".
create or replace function public.search_founders(
  p_query text,
  p_country text default null,
  p_limit int default 25
)
returns table (
  id uuid, username text, full_name text, avatar_url text, headline text,
  country_code text, points bigint, is_verified boolean, venture_name text,
  founder_number bigint, is_early_founder boolean, is_ranked boolean
)
language sql stable as $$
  select p.id, p.username, p.full_name, p.avatar_url, p.headline,
         p.country_code, p.total_rank_points, p.is_verified, v.name,
         p.founder_number, p.is_early_founder, p.is_ranked
  from public.profiles p
  left join lateral (
    select name from public.ventures
     where founder_id = p.id and status = 'ACTIVE'
     order by sort_order asc, created_at asc limit 1
  ) v on true
  where p.is_suspended = false
    and (p_country is null or p.country_code = p_country)
    and (
      p.username ilike '%' || p_query || '%'
      or p.full_name ilike '%' || p_query || '%'
      or exists (
        select 1 from public.ventures ve
         where ve.founder_id = p.id and ve.status = 'ACTIVE'
           and ve.name ilike '%' || p_query || '%'
      )
    )
  order by p.is_ranked desc, p.total_rank_points desc, p.rank_reached_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- A captured payment is what puts a non-early founder on the board.
-- ---------------------------------------------------------------------------
create or replace function public.award_rank_points(
  p_razorpay_payment_id text,
  p_razorpay_order_id text,
  p_currency text,
  p_amount_subunit bigint,
  p_base_amount_subunit bigint,
  p_captured_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.boost_orders%rowtype;
  v_founder public.profiles%rowtype;
  v_points bigint;
  v_payment_id uuid;
  v_prev_global int; v_prev_country int;
  v_new_global int; v_new_country int;
  v_today date := (now() at time zone 'utc')::date;
begin
  select id into v_payment_id
    from public.payments where razorpay_payment_id = p_razorpay_payment_id;
  if v_payment_id is not null then
    return jsonb_build_object('status', 'ALREADY_PROCESSED', 'payment_id', v_payment_id);
  end if;

  select * into v_order from public.boost_orders
   where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    return jsonb_build_object('status', 'UNKNOWN_ORDER');
  end if;

  select * into v_founder from public.profiles where id = v_order.founder_id for update;
  if not found then
    return jsonb_build_object('status', 'UNKNOWN_FOUNDER');
  end if;

  v_points := greatest(floor(coalesce(p_base_amount_subunit, 0)::numeric / 100)::bigint, 0);

  v_prev_global  := public.global_rank_of(
    v_founder.total_rank_points, v_founder.rank_reached_at, v_founder.is_ranked);
  v_prev_country := public.country_rank_of(
    v_founder.country_code, v_founder.total_rank_points, v_founder.rank_reached_at, v_founder.is_ranked);

  insert into public.payments (
    boost_order_id, founder_id, razorpay_payment_id, razorpay_order_id,
    currency, amount_subunit, base_currency, base_amount_subunit,
    rank_points_awarded, status, captured_at
  ) values (
    v_order.id, v_founder.id, p_razorpay_payment_id, p_razorpay_order_id,
    upper(p_currency), p_amount_subunit, 'INR', p_base_amount_subunit,
    v_points, 'CAPTURED', coalesce(p_captured_at, now())
  )
  returning id into v_payment_id;

  insert into public.rank_ledger (founder_id, points, type, payment_id, reason)
  values (v_founder.id, v_points, 'PAYMENT', v_payment_id, 'Boost payment captured');

  update public.profiles
     set total_rank_points = total_rank_points + v_points,
         rank_reached_at = now(),
         -- The qualifying payment. Order creation already enforced the
         -- currency minimum, so any capture earns a place on the board.
         is_ranked = true
   where id = v_founder.id
   returning * into v_founder;

  insert into public.daily_scores (founder_id, date_utc, points)
  values (v_founder.id, v_today, v_points)
  on conflict (founder_id, date_utc)
  do update set points = public.daily_scores.points + excluded.points, updated_at = now();

  update public.boost_orders
     set status = 'PAID', completed_at = now()
   where id = v_order.id;

  v_new_global  := public.global_rank_of(
    v_founder.total_rank_points, v_founder.rank_reached_at, v_founder.is_ranked);
  v_new_country := public.country_rank_of(
    v_founder.country_code, v_founder.total_rank_points, v_founder.rank_reached_at, v_founder.is_ranked);

  insert into public.activity_events (founder_id, type, metadata)
  values (v_founder.id, 'BOOSTED',
          jsonb_build_object('global_rank', v_new_global, 'country_rank', v_new_country));

  if v_new_global = 1 and coalesce(v_prev_global, 999999) > 1 then
    insert into public.activity_events (founder_id, type, metadata)
    values (v_founder.id, 'REACHED_NUMBER_ONE', jsonb_build_object('scope', 'GLOBAL'));
  elsif v_new_global <= 10 and coalesce(v_prev_global, 999999) > 10 then
    insert into public.activity_events (founder_id, type, metadata)
    values (v_founder.id, 'ENTERED_TOP_10', jsonb_build_object('scope', 'GLOBAL'));
  elsif v_prev_global is not null and v_new_global < v_prev_global then
    insert into public.activity_events (founder_id, type, metadata)
    values (v_founder.id, 'RANK_UP',
            jsonb_build_object('from', v_prev_global, 'to', v_new_global));
  end if;

  return jsonb_build_object(
    'status', 'AWARDED',
    'payment_id', v_payment_id,
    'founder_id', v_founder.id,
    'username', v_founder.username,
    'rank_points', v_points,
    'total_rank_points', v_founder.total_rank_points,
    'previous_global_rank', v_prev_global,
    'new_global_rank', v_new_global,
    'previous_country_rank', v_prev_country,
    'new_country_rank', v_new_country,
    'country_code', v_founder.country_code
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reversal recomputes eligibility.
--
-- An Early Founder keeps their place - it was never bought. A paid founder
-- whose last captured payment is reversed goes back to Unranked.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_rank_points(
  p_razorpay_payment_id text,
  p_type text default 'REFUND',
  p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_founder public.profiles%rowtype;
  v_new_status text;
  v_deduct bigint;
  v_date date;
begin
  if p_type not in ('REFUND', 'CHARGEBACK') then
    raise exception 'INVALID_REVOKE_TYPE';
  end if;

  select * into v_payment from public.payments
   where razorpay_payment_id = p_razorpay_payment_id for update;
  if not found then
    return jsonb_build_object('status', 'UNKNOWN_PAYMENT');
  end if;

  v_new_status := case when p_type = 'CHARGEBACK' then 'DISPUTED' else 'REFUNDED' end;

  if v_payment.status <> 'CAPTURED' then
    return jsonb_build_object('status', 'ALREADY_REVERSED');
  end if;

  select * into v_founder from public.profiles where id = v_payment.founder_id for update;

  v_deduct := v_payment.rank_points_awarded;
  v_date := (coalesce(v_payment.captured_at, v_payment.created_at) at time zone 'utc')::date;

  update public.payments set status = v_new_status where id = v_payment.id;

  insert into public.rank_ledger (founder_id, points, type, payment_id, reason)
  values (v_founder.id, -v_deduct, p_type, v_payment.id,
          coalesce(p_reason, 'Payment ' || lower(v_new_status)));

  update public.profiles p
     set total_rank_points = greatest(p.total_rank_points - v_deduct, 0),
         is_ranked = p.is_early_founder or exists (
           select 1 from public.payments pay
            where pay.founder_id = p.id and pay.status = 'CAPTURED'
         )
   where p.id = v_founder.id;

  update public.daily_scores
     set points = greatest(points - v_deduct, 0), updated_at = now()
   where founder_id = v_founder.id and date_utc = v_date;

  if v_payment.boost_order_id is not null then
    update public.boost_orders
       set status = case when p_type = 'CHARGEBACK' then 'DISPUTED' else 'REFUNDED' end
     where id = v_payment.boost_order_id;
  end if;

  return jsonb_build_object('status', 'REVOKED', 'points', v_deduct, 'founder_id', v_founder.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
--
-- The new columns are deliberately absent from the profiles UPDATE grant in
-- 0004, so a founder's own session cannot write founder_number,
-- is_early_founder, is_ranked or profile_completed_at.
-- ---------------------------------------------------------------------------
revoke all on function
  public.award_rank_points(text, text, text, bigint, bigint, timestamptz),
  public.revoke_rank_points(text, text, text)
  from public, anon, authenticated;

grant execute on function
  public.award_rank_points(text, text, text, bigint, bigint, timestamptz),
  public.revoke_rank_points(text, text, text)
  to service_role;

grant execute on function
  public.create_founder_profile(text, text, text, text)
  to authenticated;

grant execute on function
  public.leaderboard_all_time(text, int, int),
  public.leaderboard_today(text, int, int),
  public.leaderboard_count(text, text),
  public.founder_ranks(uuid),
  public.next_rank_gap(uuid),
  public.search_founders(text, text, int),
  public.early_founder_status(),
  public.early_founder_limit(),
  public.global_rank_of(bigint, timestamptz, boolean),
  public.country_rank_of(text, bigint, timestamptz, boolean)
  to anon, authenticated, service_role;
