-- FounderUp - how long #1 has been #1
--
-- Every leaderboard's #1 shows how long they have held the spot. A founder's
-- own row can't answer that: the leader boosting again moves rank_reached_at
-- without ending their lead, and a refund above someone hands them #1 without
-- touching their row at all. So the database records reigns - who held #1 on
-- which board, from when, until when.
--
-- Boards match the four leaderboard views: ALL_TIME or TODAY, for GLOBAL or a
-- single country. A TODAY reign belongs to one UTC day, like the Today board.
--
-- Triggers maintain the reigns, so every path that can move #1 - a boost, a
-- refund, an admin adjustment, a suspension, a country change, a founder
-- joining or being deleted - keeps them true.

create table public.leader_reigns (
  id          bigserial primary key,
  board       text not null check (board in ('ALL_TIME', 'TODAY')),
  scope       text not null check (scope = 'GLOBAL' or scope ~ '^[A-Z]{2}$'),
  day_utc     date,
  founder_id  uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  constraint leader_reigns_today_has_day check ((board = 'TODAY') = (day_utc is not null)),
  constraint leader_reigns_ends_after_start check (ended_at is null or ended_at >= started_at)
);

-- At most one sitting #1 per board, scope and day.
create unique index leader_reigns_one_open
  on public.leader_reigns (board, scope, coalesce(day_utc, date '-infinity'))
  where ended_at is null;

create index leader_reigns_founder_idx on public.leader_reigns (founder_id);

-- Private: the app reads the sitting #1 through current_leader().
alter table public.leader_reigns enable row level security;
revoke all on public.leader_reigns from anon, authenticated;
revoke all on sequence public.leader_reigns_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Re-deriving #1
--
-- Uses exactly the filters and ordering of leaderboard_all_time and
-- leaderboard_today, so the reign always names the founder those boards show
-- at the top.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_leader(p_board text, p_scope text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_at timestamptz;
  v_leader uuid;
  v_open public.leader_reigns%rowtype;
begin
  -- One lock for every board, held to commit: two boosts landing together
  -- can't both open a reign, and a single lock can't be taken out of order.
  -- Boosts are rare enough that serialising this step costs nothing.
  perform pg_advisory_xact_lock(hashtextextended('founderup:leader_reigns', 0));

  -- The wall clock, read once the lock is held. now() is when this
  -- transaction began, which can be earlier than a reign another transaction
  -- opened and committed while this one waited - so it can't stamp a handover.
  v_at := clock_timestamp();

  if p_board = 'ALL_TIME' then
    select p.id into v_leader
      from public.profiles p
     where p.is_suspended = false
       and p.is_ranked = true
       and (p_scope = 'GLOBAL' or p.country_code = p_scope)
     order by p.total_rank_points desc, p.rank_reached_at asc
     limit 1;
  else
    select p.id into v_leader
      from public.daily_scores d
      join public.profiles p on p.id = d.founder_id
     where d.date_utc = v_day
       and d.points > 0
       and p.is_suspended = false
       and (p_scope = 'GLOBAL' or p.country_code = p_scope)
     order by d.points desc, d.updated_at asc
     limit 1;
  end if;

  select * into v_open
    from public.leader_reigns
   where board = p_board
     and scope = p_scope
     and ended_at is null
     and day_utc is not distinct from (case when p_board = 'TODAY' then v_day end)
   for update;

  -- Same #1 as before: the reign, and its clock, carry on.
  if found and v_open.founder_id = v_leader then
    return;
  end if;

  if found then
    update public.leader_reigns
       set ended_at = greatest(v_at, v_open.started_at)
     where id = v_open.id;
  end if;

  if v_leader is not null then
    insert into public.leader_reigns (board, scope, day_utc, founder_id, started_at)
    values (p_board, p_scope, case when p_board = 'TODAY' then v_day end, v_leader, v_at);
  end if;
end;
$$;

-- The given boards, for GLOBAL and each given country.
create or replace function public.refresh_leaders(p_boards text[], p_countries text[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_board text;
  v_scope text;
begin
  for v_board in select distinct b from unnest(p_boards) b where b is not null loop
    for v_scope in
      select distinct s from unnest(array['GLOBAL'] || p_countries) s where s is not null
    loop
      perform public.refresh_leader(v_board, v_scope);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.profiles_refresh_leaders()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- A newcomer can lead an empty country board on arrival.
    perform public.refresh_leaders(array['ALL_TIME'], array[new.country_code]);
  elsif tg_op = 'DELETE' then
    perform public.refresh_leaders(array['ALL_TIME', 'TODAY'], array[old.country_code]);
  else
    perform public.refresh_leaders(
      -- Points alone never move the Today board; daily_scores does that.
      case when old.is_suspended is distinct from new.is_suspended
             or old.country_code is distinct from new.country_code
           then array['ALL_TIME', 'TODAY']
           else array['ALL_TIME']
      end,
      array[old.country_code, new.country_code]);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_refresh_leaders on public.profiles;
create trigger profiles_refresh_leaders
  after insert or delete on public.profiles
  for each row execute function public.profiles_refresh_leaders();

drop trigger if exists profiles_refresh_leaders_on_update on public.profiles;
create trigger profiles_refresh_leaders_on_update
  after update of total_rank_points, rank_reached_at, is_ranked, is_suspended, country_code
  on public.profiles
  for each row
  when (old.total_rank_points is distinct from new.total_rank_points
     or old.rank_reached_at   is distinct from new.rank_reached_at
     or old.is_ranked         is distinct from new.is_ranked
     or old.is_suspended      is distinct from new.is_suspended
     or old.country_code      is distinct from new.country_code)
  execute function public.profiles_refresh_leaders();

create or replace function public.daily_scores_refresh_leaders()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_day date;
  v_founder uuid;
  v_country text;
begin
  if tg_op = 'DELETE' then
    v_day := old.date_utc;
    v_founder := old.founder_id;
  else
    v_day := new.date_utc;
    v_founder := new.founder_id;
  end if;

  -- Only today's board is shown; a refund touching an earlier day is history.
  if v_day <> (now() at time zone 'utc')::date then
    return null;
  end if;

  -- A founder being deleted is handled by the profiles trigger.
  select country_code into v_country from public.profiles where id = v_founder;
  if not found then
    return null;
  end if;

  perform public.refresh_leaders(array['TODAY'], array[v_country]);
  return null;
end;
$$;

drop trigger if exists daily_scores_refresh_leaders on public.daily_scores;
create trigger daily_scores_refresh_leaders
  after insert or update or delete on public.daily_scores
  for each row execute function public.daily_scores_refresh_leaders();

-- ---------------------------------------------------------------------------
-- The boards as they stand
--
-- There is no history saying when today's leaders took #1, so each reign
-- starts when its holder reached the score that holds it - the best evidence
-- available. From here on the triggers record it exactly.
-- ---------------------------------------------------------------------------
insert into public.leader_reigns (board, scope, founder_id, started_at)
select 'ALL_TIME', scope, id, rank_reached_at
  from (
    select distinct on (scope) scope, id, rank_reached_at
      from (
        select 'GLOBAL' as scope, p.id, p.total_rank_points, p.rank_reached_at
          from public.profiles p
         where p.is_suspended = false and p.is_ranked = true
        union all
        select p.country_code, p.id, p.total_rank_points, p.rank_reached_at
          from public.profiles p
         where p.is_suspended = false and p.is_ranked = true
      ) ranked
     order by scope, total_rank_points desc, rank_reached_at asc
  ) leaders;

insert into public.leader_reigns (board, scope, day_utc, founder_id, started_at)
select 'TODAY', scope, (now() at time zone 'utc')::date, founder_id, updated_at
  from (
    select distinct on (scope) scope, founder_id, updated_at
      from (
        select 'GLOBAL' as scope, d.founder_id, d.points, d.updated_at
          from public.daily_scores d
          join public.profiles p on p.id = d.founder_id
         where d.date_utc = (now() at time zone 'utc')::date
           and d.points > 0 and p.is_suspended = false
        union all
        select p.country_code, d.founder_id, d.points, d.updated_at
          from public.daily_scores d
          join public.profiles p on p.id = d.founder_id
         where d.date_utc = (now() at time zone 'utc')::date
           and d.points > 0 and p.is_suspended = false
      ) today
     order by scope, points desc, updated_at asc
  ) leaders;

-- ---------------------------------------------------------------------------
-- What the app reads: the sitting #1 of one leaderboard view, and since when.
-- p_period and p_country take the same values as the leaderboard functions.
-- ---------------------------------------------------------------------------
create or replace function public.current_leader(
  p_period text default 'ALL_TIME',
  p_country text default null
)
returns table (founder_id uuid, started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.founder_id, r.started_at
    from public.leader_reigns r
   where r.board = case when p_period = 'TODAY' then 'TODAY' else 'ALL_TIME' end
     and r.scope = coalesce(upper(p_country), 'GLOBAL')
     and r.ended_at is null
     and r.day_utc is not distinct from
         (case when p_period = 'TODAY' then (now() at time zone 'utc')::date end)
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.refresh_leader(text, text) from public, anon, authenticated;
revoke all on function public.refresh_leaders(text[], text[]) from public, anon, authenticated;
grant execute on function public.refresh_leader(text, text) to service_role;
grant execute on function public.refresh_leaders(text[], text[]) to service_role;

revoke all on function public.current_leader(text, text) from public;
grant execute on function public.current_leader(text, text) to anon, authenticated, service_role;
