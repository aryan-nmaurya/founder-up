-- FounderUp - row level security (plan §52)
--
-- Rule of thumb: the browser may read public founder data and edit its own
-- profile text. It may never touch total_rank_points, payment status, the
-- ledger, or admin fields. Those are service-role only.

alter table public.profiles        enable row level security;
alter table public.ventures        enable row level security;
alter table public.boost_orders    enable row level security;
alter table public.payments        enable row level security;
alter table public.rank_ledger     enable row level security;
alter table public.daily_scores    enable row level security;
alter table public.reports         enable row level security;
alter table public.click_events    enable row level security;
alter table public.profile_views   enable row level security;
alter table public.activity_events enable row level security;
alter table public.webhook_events  enable row level security;
alter table public.audit_logs      enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles are publicly readable when active"
  on public.profiles for select
  using (is_suspended = false or auth_user_id = auth.uid());

create policy "founders update their own profile"
  on public.profiles for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Column-level grants are what actually stop a founder from writing their own
-- score. RLS alone cannot restrict columns.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (
  full_name, avatar_url, headline, bio,
  website_url, x_url, linkedin_url, github_url,
  contact_type, contact_value
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- ventures
-- ---------------------------------------------------------------------------
create policy "active ventures are publicly readable"
  on public.ventures for select
  using (
    status = 'ACTIVE'
    or founder_id in (select id from public.profiles where auth_user_id = auth.uid())
  );

create policy "founders insert their own ventures"
  on public.ventures for insert
  with check (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "founders update their own ventures"
  on public.ventures for update
  using (founder_id in (select id from public.profiles where auth_user_id = auth.uid()))
  with check (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "founders delete their own ventures"
  on public.ventures for delete
  using (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

revoke all on public.ventures from anon, authenticated;
grant select on public.ventures to anon, authenticated;
grant insert, update, delete on public.ventures to authenticated;

-- Plan §11 - cap ventures per founder.
create or replace function public.enforce_venture_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.ventures where founder_id = new.founder_id) >= 5 then
    raise exception 'VENTURE_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

create trigger ventures_limit before insert on public.ventures
  for each row execute function public.enforce_venture_limit();

-- ---------------------------------------------------------------------------
-- money tables - read your own, write nothing
-- ---------------------------------------------------------------------------
create policy "founders read their own boost orders"
  on public.boost_orders for select
  using (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "founders read their own payments"
  on public.payments for select
  using (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "founders read their own ledger"
  on public.rank_ledger for select
  using (founder_id in (select id from public.profiles where auth_user_id = auth.uid()));

revoke all on public.boost_orders, public.payments, public.rank_ledger
  from anon, authenticated;
grant select on public.boost_orders, public.payments, public.rank_ledger to authenticated;

-- ---------------------------------------------------------------------------
-- public read-only tables
-- ---------------------------------------------------------------------------
create policy "daily scores are public" on public.daily_scores for select using (true);
create policy "activity is public" on public.activity_events for select using (true);

revoke all on public.daily_scores, public.activity_events from anon, authenticated;
grant select on public.daily_scores, public.activity_events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reports (plan §47)
-- ---------------------------------------------------------------------------
create policy "authenticated founders file reports"
  on public.reports for insert
  with check (reporter_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "founders read their own reports"
  on public.reports for select
  using (reporter_id in (select id from public.profiles where auth_user_id = auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- internal tables - no client access at all
-- ---------------------------------------------------------------------------
revoke all on public.click_events, public.profile_views,
              public.webhook_events, public.audit_logs
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.award_rank_points(text, text, text, bigint, bigint, timestamptz),
  public.revoke_rank_points(text, text, text),
  public.admin_adjust_points(uuid, bigint, text, uuid),
  public.record_profile_view(uuid, text),
  public.record_click(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function
  public.award_rank_points(text, text, text, bigint, bigint, timestamptz),
  public.revoke_rank_points(text, text, text),
  public.admin_adjust_points(uuid, bigint, text, uuid),
  public.record_profile_view(uuid, text),
  public.record_click(uuid, text, uuid)
  to service_role;

grant execute on function
  public.create_founder_profile(text, text, text, text),
  public.change_username(text),
  public.change_country(text, int),
  public.username_available(text)
  to authenticated;

grant execute on function
  public.leaderboard_all_time(text, int, int),
  public.leaderboard_today(text, int, int),
  public.leaderboard_count(text, text),
  public.founder_ranks(uuid),
  public.next_rank_gap(uuid),
  public.search_founders(text, text, int),
  public.founder_stats(uuid),
  public.global_rank_of(bigint, timestamptz),
  public.country_rank_of(text, bigint, timestamptz)
  to anon, authenticated, service_role;
