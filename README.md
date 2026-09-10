# FounderUp

**The leaderboard for founders.** Discover founders, see what they're building, and connect.

Founders create a public profile, list what they've built or the business they run, and appear on a leaderboard. Rank is determined by paid Rank Points — and the site says so, plainly, next to every leaderboard.

Built from `Docs/implementation_plan.md`.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4, light mode only |
| Database | PostgreSQL via Supabase (auth, storage, RLS) |
| Payments | Razorpay (Orders + Checkout + webhooks) |
| Hosting | Vercel |

No component library. Around fifteen small components in `src/components/ui` and `src/components`.

---

## Getting started

```bash
npm install
cp .env.example .env.local
```

### 1. Database

Either point at a hosted Supabase project, or run one locally:

```bash
npx supabase start
```

Apply the schema. With the Supabase CLI:

```bash
npx supabase db reset
```

Or paste `supabase/migrations/*.sql` into the SQL editor **in order** (0001 → 0005).

### 2. Environment

Fill in `.env.local`. The Supabase URL and anon key are public by design; the
service role key and both Razorpay secrets are server-only and must never be
prefixed with `NEXT_PUBLIC_`.

### 3. Auth providers

In Supabase → Authentication → Providers, enable **Google** and **GitHub**, and
add `http://localhost:3000/auth/callback` (plus your production URL) as a
redirect URL. Email magic links work out of the box.

### 4. Run

```bash
npm run dev
```

Optionally seed obviously-fake local data:

```bash
npm run seed
```

The seed refuses to run against a non-local Supabase. Plan §68: never launch
with fabricated founders or payments.

---

## How ranking works

One Rank Point is one rupee of **captured** payment value.

```
INR payment:  rankPoints = amount_in_paise / 100
USD payment:  rankPoints = razorpay base_amount (INR paise) / 100
```

Rounded down. Foreign currency is converted to its INR base value before points
are derived, so no currency can be arbitraged into a cheaper rank.

Four views, and only four: `Global | Country` × `All-Time | Today`. "Today" is a
UTC day, identical for every visitor, so a new founder always has a board they
can realistically win.

Ties break on **who reached the score first**.

Founders with zero points are not on the leaderboard; they show as *Unranked*
and appear in search.

---

## Money path

The browser can never award Rank Points. Every step is server-side.

```
Browser
  │  POST /api/boost/create  { amount, currency }
  ▼
Server ── validates amount against the currency minimum
       ── creates a boost_order (CREATED)
       ── creates the Razorpay Order      ──▶ Razorpay
  │
  ▼  Razorpay Checkout opens with that order id
  │
  ├─ POST /api/boost/verify   (signature + re-fetch from Razorpay)
  └─ POST /api/webhooks/razorpay  ◀── authoritative
                    │
                    ▼
          award_rank_points()   one transaction:
            1. insert payment          4. bump profile total
            2. compute Rank Points     5. bump today's score
            3. insert ledger entry     6. mark order PAID
```

Safety properties, all covered by the SQL test suite:

- **Idempotent.** `razorpay_payment_id` is unique and `award_rank_points`
  returns `ALREADY_PROCESSED` on a repeat, so webhook retries are free.
- **Authoritative amounts.** Amounts come from Razorpay's API, never from the
  browser callback.
- **Serialised.** Concurrent boosts for one founder lock the profile row.
- **Auditable.** No score ever changes without a `rank_ledger` row.
- **Reversible.** A bank-forced refund or chargeback writes a negative ledger
  entry, decrements the all-time and daily scores, and keeps the original
  payment row.

### Refunds

FounderUp does not offer refunds — Rank Points are delivered instantly and every
boost is final (`/refunds`). The code still handles `payment.refunded` and
dispute webhooks, because a bank or card network can reverse a payment whatever
the policy says. When the money goes, the points go with it.

---

## Security

- **RLS everywhere.** Public reads see active profiles, ventures, daily scores
  and activity. A founder can edit only their own rows.
- **Column grants.** `total_rank_points`, payment status, the ledger and admin
  flags are not in the `authenticated` update grant, so RLS can't be talked
  into letting a founder write their own score.
- **Service role isolation.** Points, tracking and admin operations run through
  `SECURITY DEFINER` functions granted only to `service_role`.
- **Username and country** changes go through guarded functions — reserved-name
  blocking, uniqueness, and a 30-day country cooldown (plan §30), all audited.
- **URLs** are validated to http/https only; `javascript:` and `data:` are
  rejected. External links carry `rel="noopener noreferrer"`.
- **User text** is stored and rendered as plain text. No HTML is ever rendered
  from user input.
- **Rate limits** on signup, username checks, profile writes, search, boost
  creation, verification, reporting and tracking.

The rate limiter is an in-process fixed window (`src/lib/rate-limit.ts`). On a
single server it is exact; on serverless it is per-instance. Swap the store for
Redis when traffic warrants — the call sites don't change.

---

## Project layout

```
src/
  app/
    page.tsx                  leaderboard (the product)
    [username]/               public founder profile + OG card
    join/  onboarding/        auth and signup
    dashboard/                rank, reach, boost history
    settings/                 profile and ventures editors
    search/                   founder search
    admin/                    founders, payments, reports, webhooks
    about/ pricing/ terms/ privacy/ refunds/ shipping/ contact/
    api/
      boost/create            create Razorpay order
      boost/verify            checkout callback
      webhooks/razorpay       authoritative payment events
      track/ search/ report/ username/check
  components/                 ~20 focused components
  lib/                        auth, db, ranking, payments, razorpay, geo,
                              validation, rate-limit, webhooks
supabase/migrations/          schema, functions, RLS, storage
scripts/seed-dev.mts           local demo data
```

---

## Before going live

1. **Razorpay KYC**, then request **International Payments** activation. USD
   checkout will not work until it is approved, and approval requires the
   policy pages this repo ships (`/terms`, `/privacy`, `/refunds`, `/shipping`,
   `/contact`, `/pricing`).
2. **Complete the legal pages.** They are written in plain language and marked
   where operator name, address and governing law must be filled in. Have an
   Indian lawyer and accountant review the commercial and tax language,
   especially for international payments.
3. **Configure the webhook** at `/api/webhooks/razorpay` for `order.paid`,
   `payment.captured`, `payment.failed`, `payment.refunded`, `refund.processed`,
   `payment.dispute.created` and `payment.dispute.lost`, and set
   `RAZORPAY_WEBHOOK_SECRET` to the same signing secret.
4. **Make yourself an admin**: `update profiles set is_admin = true where
   username = 'you';`
5. **Invite real founders** before launch so the board isn't empty. Never
   fabricate profiles, payments or ranks.

---

## Testing

`npm run build` type-checks the whole app.

The ranking and payment logic has a SQL suite covering the cases that actually
matter — duplicate webhooks, unknown orders, tie-breaks, USD conversion,
rounding, forced refunds, double refunds, daily reset, venture caps, country
cooldown and reserved usernames. Run it against a scratch Postgres:

```bash
psql "$DATABASE_URL" -f supabase/tests/ranking_test.sql
```

## What is deliberately not built

Dark mode, internal chat, followers, posts, comments, likes, notifications,
teams, categories, city/state ranking, subscriptions, referrals and badges.
Plan §63. The only question worth answering first is whether founders will pay
to climb.
