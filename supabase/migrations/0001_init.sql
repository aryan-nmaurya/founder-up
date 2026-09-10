-- FounderUp - initial schema
-- Plan sections 13, 14, 15, 22, 23, 52.
--
-- Design rules encoded here:
--   * The browser can never award Rank Points. All mutations that touch score
--     run inside SECURITY DEFINER functions callable only by the service role.
--   * Every score change is written to rank_ledger. Scores are never edited blind.
--   * razorpay_payment_id is unique, which is what makes webhook retries safe.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- profiles (plan §10)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid not null unique references auth.users (id) on delete cascade,

  username          text not null unique,
  full_name         text not null,
  avatar_url        text,

  headline          text,
  bio               text,

  country_code      text not null,
  country_changed_at timestamptz,

  website_url       text,
  x_url             text,
  linkedin_url      text,
  github_url        text,

  contact_type      text not null default 'WEBSITE'
                      check (contact_type in ('WEBSITE','X','LINKEDIN','EMAIL')),
  contact_value     text,

  total_rank_points bigint not null default 0 check (total_rank_points >= 0),
  -- Plan §15 tie-breaker: whoever reached the score first stays above.
  rank_reached_at   timestamptz not null default now(),

  is_verified       boolean not null default false,
  is_suspended      boolean not null default false,
  is_admin          boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_country_format
    check (country_code ~ '^[A-Z]{2}$'),
  constraint profiles_headline_len check (headline is null or char_length(headline) <= 80),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 500),
  constraint profiles_name_len check (char_length(full_name) between 1 and 60)
);

-- ---------------------------------------------------------------------------
-- ventures (plan §11) - one entity for both projects and businesses
-- ---------------------------------------------------------------------------
create table public.ventures (
  id          uuid primary key default gen_random_uuid(),
  founder_id  uuid not null references public.profiles (id) on delete cascade,

  type        text not null check (type in ('PROJECT','BUSINESS')),
  name        text not null,
  description text,
  url         text,
  logo_url    text,

  status      text not null default 'ACTIVE' check (status in ('ACTIVE','HIDDEN')),
  sort_order  int not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint ventures_name_len check (char_length(name) between 1 and 60),
  constraint ventures_desc_len check (description is null or char_length(description) <= 160)
);

-- ---------------------------------------------------------------------------
-- boost_orders (plan §13) - every attempted boost
-- ---------------------------------------------------------------------------
create table public.boost_orders (
  id                 uuid primary key default gen_random_uuid(),
  founder_id         uuid not null references public.profiles (id) on delete cascade,

  requested_amount   bigint not null check (requested_amount > 0), -- subunits
  requested_currency text not null check (requested_currency in ('INR','USD')),

  razorpay_order_id  text unique,

  status             text not null default 'CREATED'
                       check (status in ('CREATED','PAID','FAILED','REFUNDED','DISPUTED')),

  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- payments (plan §13)
-- ---------------------------------------------------------------------------
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  boost_order_id       uuid references public.boost_orders (id) on delete set null,
  founder_id           uuid not null references public.profiles (id) on delete cascade,

  razorpay_payment_id  text not null unique,
  razorpay_order_id    text,

  currency             text not null,
  amount_subunit       bigint not null,

  -- For non-INR payments Razorpay reports base_amount in INR. That is what
  -- Rank Points are derived from, so currency choice can't be arbitraged.
  base_currency        text not null default 'INR',
  base_amount_subunit  bigint not null,

  rank_points_awarded  bigint not null default 0,

  status               text not null default 'CAPTURED'
                         check (status in ('CAPTURED','REFUNDED','DISPUTED')),
  captured_at          timestamptz,

  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rank_ledger (plan §13) - append-only audit trail for every score change
-- ---------------------------------------------------------------------------
create table public.rank_ledger (
  id         uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles (id) on delete cascade,

  points     bigint not null,
  type       text not null
               check (type in ('PAYMENT','REFUND','CHARGEBACK','ADMIN_ADJUSTMENT')),

  payment_id uuid references public.payments (id) on delete set null,
  reason     text,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- daily_scores (plan §13) - powers the Today leaderboard
-- ---------------------------------------------------------------------------
create table public.daily_scores (
  founder_id uuid not null references public.profiles (id) on delete cascade,
  date_utc   date not null,
  points     bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (founder_id, date_utc)
);

-- ---------------------------------------------------------------------------
-- reports (plan §13, §47)
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  reason      text not null
                check (reason in ('IMPERSONATION','SPAM','SCAM','ILLEGAL','EXPLICIT','HATE','MISLEADING_LINK','OTHER')),
  details     text,
  status      text not null default 'OPEN' check (status in ('OPEN','REVIEWING','ACTIONED','DISMISSED')),
  created_at  timestamptz not null default now(),
  constraint reports_details_len check (details is null or char_length(details) <= 1000)
);

-- ---------------------------------------------------------------------------
-- click_events / profile_views (plan §12, §55)
-- ---------------------------------------------------------------------------
create table public.click_events (
  id         bigserial primary key,
  founder_id uuid not null references public.profiles (id) on delete cascade,
  link_type  text not null
               check (link_type in ('WEBSITE','X','LINKEDIN','GITHUB','EMAIL','CONNECT','VENTURE')),
  venture_id uuid references public.ventures (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profile_views (
  id         bigserial primary key,
  founder_id uuid not null references public.profiles (id) on delete cascade,
  -- coarse day bucket + hashed visitor so we can dedupe without storing IPs
  date_utc   date not null default (now() at time zone 'utc')::date,
  visitor_hash text not null,
  created_at timestamptz not null default now(),
  unique (founder_id, date_utc, visitor_hash)
);

-- ---------------------------------------------------------------------------
-- activity_events (plan §43, §70) - system generated only, never user posts
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id         bigserial primary key,
  founder_id uuid not null references public.profiles (id) on delete cascade,
  type       text not null
               check (type in ('JOINED','BOOSTED','RANK_UP','ENTERED_TOP_10','REACHED_NUMBER_ONE')),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- webhook_events (plan §53) - so failed webhooks are inspectable and retryable
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'razorpay',
  event_id      text,
  event_type    text not null,
  payload       jsonb not null,
  status        text not null default 'PENDING'
                  check (status in ('PENDING','PROCESSED','FAILED','IGNORED')),
  error         text,
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- audit_logs (plan §13, §30, §53)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target_type text,
  target_id  text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (plan §14)
-- ---------------------------------------------------------------------------
create index profiles_rank_idx
  on public.profiles (total_rank_points desc, rank_reached_at asc)
  where is_suspended = false;
create index profiles_country_rank_idx
  on public.profiles (country_code, total_rank_points desc, rank_reached_at asc)
  where is_suspended = false;
create index profiles_country_idx on public.profiles (country_code);
create index profiles_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);

create index daily_scores_leaderboard_idx on public.daily_scores (date_utc, points desc);

create index ventures_founder_idx on public.ventures (founder_id, sort_order);
create index ventures_name_trgm_idx on public.ventures using gin (name gin_trgm_ops);

create index payments_founder_idx on public.payments (founder_id, created_at desc);
create index boost_orders_founder_idx on public.boost_orders (founder_id, created_at desc);
create index rank_ledger_founder_idx on public.rank_ledger (founder_id, created_at desc);

create index click_events_founder_idx on public.click_events (founder_id, created_at desc);
create index profile_views_founder_idx on public.profile_views (founder_id, date_utc);
create index activity_events_recent_idx on public.activity_events (created_at desc);
create index reports_status_idx on public.reports (status, created_at desc);
create index webhook_events_status_idx on public.webhook_events (status, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger ventures_touch before update on public.ventures
  for each row execute function public.touch_updated_at();
