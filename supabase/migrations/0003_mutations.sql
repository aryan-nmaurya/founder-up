-- FounderUp - state-changing functions
-- Plan sections 9, 22, 23, 30, 53.

-- ---------------------------------------------------------------------------
-- Onboarding (plan §9)
-- ---------------------------------------------------------------------------
create or replace function public.create_founder_profile(
  p_username text,
  p_full_name text,
  p_country_code text,
  p_headline text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if exists (select 1 from public.profiles where auth_user_id = v_uid) then
    raise exception 'PROFILE_EXISTS';
  end if;

  p_username := lower(trim(p_username));
  if public.is_reserved_username(p_username) then
    raise exception 'USERNAME_RESERVED';
  end if;
  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'USERNAME_TAKEN';
  end if;

  insert into public.profiles (auth_user_id, username, full_name, country_code, headline)
  values (v_uid, p_username, trim(p_full_name), upper(p_country_code), nullif(trim(p_headline), ''))
  returning id into v_id;

  insert into public.activity_events (founder_id, type) values (v_id, 'JOINED');

  return v_id;
end;
$$;

create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    p_username ~ '^[a-z0-9_]{3,30}$'
    and not public.is_reserved_username(p_username)
    and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

create or replace function public.change_username(p_username text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_profile from public.profiles where auth_user_id = v_uid;
  if not found then raise exception 'NO_PROFILE'; end if;

  p_username := lower(trim(p_username));
  if p_username = v_profile.username then return; end if;
  if p_username !~ '^[a-z0-9_]{3,30}$' then raise exception 'USERNAME_INVALID'; end if;
  if public.is_reserved_username(p_username) then raise exception 'USERNAME_RESERVED'; end if;
  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'USERNAME_TAKEN';
  end if;

  update public.profiles set username = p_username where id = v_profile.id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (v_profile.id, 'USERNAME_CHANGED', 'profile', v_profile.id::text,
          jsonb_build_object('from', v_profile.username, 'to', p_username));
end;
$$;

-- Plan §30 - country drives regional ranking, so changes are cooldown-limited.
create or replace function public.change_country(p_country_code text, p_cooldown_days int default 30)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_profile from public.profiles where auth_user_id = v_uid;
  if not found then raise exception 'NO_PROFILE'; end if;

  p_country_code := upper(trim(p_country_code));
  if p_country_code !~ '^[A-Z]{2}$' then raise exception 'COUNTRY_INVALID'; end if;
  if p_country_code = v_profile.country_code then return; end if;

  if v_profile.country_changed_at is not null
     and v_profile.country_changed_at > now() - make_interval(days => p_cooldown_days) then
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
-- Awarding Rank Points (plan §22) - all six steps, one transaction
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
  -- Idempotency first (plan §21). Webhook retries must be free.
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

  -- Serialise concurrent boosts for the same founder.
  select * into v_founder from public.profiles where id = v_order.founder_id for update;
  if not found then
    return jsonb_build_object('status', 'UNKNOWN_FOUNDER');
  end if;

  -- Plan §3: 1 INR of captured value = 1 Rank Point, rounded down.
  v_points := greatest(floor(coalesce(p_base_amount_subunit, 0)::numeric / 100)::bigint, 0);

  v_prev_global  := public.global_rank_of(v_founder.total_rank_points, v_founder.rank_reached_at);
  v_prev_country := public.country_rank_of(v_founder.country_code, v_founder.total_rank_points, v_founder.rank_reached_at);

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
         rank_reached_at = now()
   where id = v_founder.id
   returning * into v_founder;

  insert into public.daily_scores (founder_id, date_utc, points)
  values (v_founder.id, v_today, v_points)
  on conflict (founder_id, date_utc)
  do update set points = public.daily_scores.points + excluded.points, updated_at = now();

  update public.boost_orders
     set status = 'PAID', completed_at = now()
   where id = v_order.id;

  v_new_global  := public.global_rank_of(v_founder.total_rank_points, v_founder.rank_reached_at);
  v_new_country := public.country_rank_of(v_founder.country_code, v_founder.total_rank_points, v_founder.rank_reached_at);

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
-- Clawing points back (plan §23)
--
-- FounderUp does not offer refunds, but a card network or Razorpay can still
-- force a refund or a chargeback. When that happens the points must go away,
-- and the original payment row is kept - we add a negative ledger entry.
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

  update public.profiles
     set total_rank_points = greatest(total_rank_points - v_deduct, 0)
   where id = v_founder.id;

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

-- Plan §53 - audited manual adjustment, admin only, always ledgered.
create or replace function public.admin_adjust_points(
  p_founder_id uuid,
  p_points bigint,
  p_reason text,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  insert into public.rank_ledger (founder_id, points, type, reason)
  values (p_founder_id, p_points, 'ADMIN_ADJUSTMENT', p_reason);

  update public.profiles
     set total_rank_points = greatest(total_rank_points + p_points, 0),
         rank_reached_at = case when p_points > 0 then now() else rank_reached_at end
   where id = p_founder_id
   returning total_rank_points into v_total;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, 'ADMIN_ADJUST_POINTS', 'profile', p_founder_id::text,
          jsonb_build_object('points', p_points, 'reason', p_reason));

  return jsonb_build_object('status', 'OK', 'total_rank_points', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tracking (plan §12, §55)
-- ---------------------------------------------------------------------------
create or replace function public.record_profile_view(p_founder_id uuid, p_visitor_hash text)
returns void
language sql security definer set search_path = public as $$
  insert into public.profile_views (founder_id, visitor_hash)
  values (p_founder_id, p_visitor_hash)
  on conflict (founder_id, date_utc, visitor_hash) do nothing;
$$;

create or replace function public.record_click(
  p_founder_id uuid, p_link_type text, p_venture_id uuid default null
)
returns void
language sql security definer set search_path = public as $$
  insert into public.click_events (founder_id, link_type, venture_id)
  values (p_founder_id, p_link_type, p_venture_id);
$$;

create or replace function public.founder_stats(p_founder_id uuid)
returns table (profile_views bigint, website_clicks bigint, connect_clicks bigint)
language sql stable as $$
  select
    (select count(*) from public.profile_views where founder_id = p_founder_id),
    (select count(*) from public.click_events
      where founder_id = p_founder_id and link_type = 'WEBSITE'),
    (select count(*) from public.click_events
      where founder_id = p_founder_id and link_type in ('CONNECT','X','LINKEDIN','EMAIL','GITHUB'));
$$;
