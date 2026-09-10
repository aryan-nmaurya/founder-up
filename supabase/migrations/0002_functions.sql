-- FounderUp - ranking, payment and profile functions
-- Plan sections 9, 15, 16, 22, 23, 30, 44.
--
-- Everything that can change a score lives in here as SECURITY DEFINER, and is
-- granted to service_role only. The browser has no path to these.

-- ---------------------------------------------------------------------------
-- Reserved usernames (plan §9)
-- ---------------------------------------------------------------------------
create or replace function public.is_reserved_username(p_username text)
returns boolean language sql immutable as $$
  select lower(p_username) = any (array[
    'admin','administrator','api','app','about','account','accounts','auth',
    'blog','boost','contact','dashboard','docs','faq','founder','founders',
    'founderup','help','home','join','leaderboard','legal','login','logout',
    'me','new','onboarding','payment','payments','pricing','privacy','profile',
    'refunds','register','root','search','security','settings','shipping',
    'signin','signup','sitemap','static','status','support','system','team',
    'terms','test','today','tos','user','users','www'
  ]);
$$;

-- ---------------------------------------------------------------------------
-- Rank helpers (plan §15) - null means "not ranked yet" (zero points)
-- ---------------------------------------------------------------------------
create or replace function public.global_rank_of(p_points bigint, p_reached_at timestamptz)
returns int language sql stable as $$
  select case when coalesce(p_points, 0) <= 0 then null else (
    select count(*)::int + 1
      from public.profiles p
     where p.is_suspended = false
       and p.total_rank_points > 0
       and (p.total_rank_points > p_points
            or (p.total_rank_points = p_points and p.rank_reached_at < p_reached_at))
  ) end;
$$;

create or replace function public.country_rank_of(p_country text, p_points bigint, p_reached_at timestamptz)
returns int language sql stable as $$
  select case when coalesce(p_points, 0) <= 0 then null else (
    select count(*)::int + 1
      from public.profiles p
     where p.is_suspended = false
       and p.country_code = p_country
       and p.total_rank_points > 0
       and (p.total_rank_points > p_points
            or (p.total_rank_points = p_points and p.rank_reached_at < p_reached_at))
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards (plan §15, §25, §45)
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_all_time(
  p_country text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  rank int,
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  headline text,
  country_code text,
  points bigint,
  is_verified boolean,
  venture_name text,
  venture_url text
)
language sql stable as $$
  select
    (row_number() over (order by p.total_rank_points desc, p.rank_reached_at asc))::int + p_offset as rank,
    p.id, p.username, p.full_name, p.avatar_url, p.headline, p.country_code,
    p.total_rank_points as points, p.is_verified,
    v.name as venture_name, v.url as venture_url
  from public.profiles p
  left join lateral (
    select name, url from public.ventures
     where founder_id = p.id and status = 'ACTIVE'
     order by sort_order asc, created_at asc
     limit 1
  ) v on true
  where p.is_suspended = false
    and p.total_rank_points > 0
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
  rank int,
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  headline text,
  country_code text,
  points bigint,
  is_verified boolean,
  venture_name text,
  venture_url text
)
language sql stable as $$
  select
    (row_number() over (order by d.points desc, d.updated_at asc))::int + p_offset as rank,
    p.id, p.username, p.full_name, p.avatar_url, p.headline, p.country_code,
    d.points, p.is_verified,
    v.name as venture_name, v.url as venture_url
  from public.daily_scores d
  join public.profiles p on p.id = d.founder_id
  left join lateral (
    select name, url from public.ventures
     where founder_id = p.id and status = 'ACTIVE'
     order by sort_order asc, created_at asc
     limit 1
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
     where p.is_suspended = false and p.total_rank_points > 0
       and (p_country is null or p.country_code = p_country)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- A founder's own standings (plan §27, §28)
-- ---------------------------------------------------------------------------
create or replace function public.founder_ranks(p_founder_id uuid)
returns table (
  global_rank int,
  country_rank int,
  today_global_rank int,
  today_country_rank int,
  total_points bigint,
  today_points bigint,
  country_code text
)
language sql stable as $$
  with me as (
    select * from public.profiles where id = p_founder_id
  ), today as (
    select coalesce(points, 0) as points, updated_at
      from public.daily_scores
     where founder_id = p_founder_id
       and date_utc = (now() at time zone 'utc')::date
  )
  select
    public.global_rank_of(me.total_rank_points, me.rank_reached_at),
    public.country_rank_of(me.country_code, me.total_rank_points, me.rank_reached_at),
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
    me.country_code
  from me;
$$;

-- Plan §16 - how many RP to take the next position, globally and in-country.
create or replace function public.next_rank_gap(p_founder_id uuid)
returns table (global_gap bigint, global_target_rank int, country_gap bigint, country_target_rank int)
language sql stable as $$
  with me as (select * from public.profiles where id = p_founder_id),
  g as (
    select p.total_rank_points as pts
      from public.profiles p, me
     where p.is_suspended = false
       and p.id <> me.id
       and (p.total_rank_points > me.total_rank_points
            or (p.total_rank_points = me.total_rank_points and p.rank_reached_at < me.rank_reached_at))
     order by p.total_rank_points asc
     limit 1
  ),
  c as (
    select p.total_rank_points as pts
      from public.profiles p, me
     where p.is_suspended = false
       and p.id <> me.id
       and p.country_code = me.country_code
       and (p.total_rank_points > me.total_rank_points
            or (p.total_rank_points = me.total_rank_points and p.rank_reached_at < me.rank_reached_at))
     order by p.total_rank_points asc
     limit 1
  )
  -- Overtaking the founder directly above also clears anyone tied with them,
  -- so the rank actually landed on is "everyone strictly above that score, +1".
  select
    (select greatest(g.pts - me.total_rank_points + 1, 1) from g, me),
    (select count(*)::int + 1 from public.profiles p
      where p.is_suspended = false and p.total_rank_points > (select pts from g)),
    (select greatest(c.pts - me.total_rank_points + 1, 1) from c, me),
    (select count(*)::int + 1 from public.profiles p, me
      where p.is_suspended = false and p.country_code = me.country_code
        and p.total_rank_points > (select pts from c));
$$;

-- ---------------------------------------------------------------------------
-- Search (plan §44)
-- ---------------------------------------------------------------------------
create or replace function public.search_founders(
  p_query text,
  p_country text default null,
  p_limit int default 25
)
returns table (
  id uuid, username text, full_name text, avatar_url text, headline text,
  country_code text, points bigint, is_verified boolean, venture_name text
)
language sql stable as $$
  select p.id, p.username, p.full_name, p.avatar_url, p.headline,
         p.country_code, p.total_rank_points, p.is_verified, v.name
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
  order by p.total_rank_points desc, p.rank_reached_at asc
  limit least(greatest(p_limit, 1), 50);
$$;
