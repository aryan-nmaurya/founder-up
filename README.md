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

Or paste `supabase/migrations/*.sql` into the SQL editor **in order** (0001 → 0009).

### 2. Environment

Fill in `.env.local`. The Supabase URL and anon key are public by design; the
service role key and both Razorpay secrets are server-only and must never be
prefixed with `NEXT_PUBLIC_`.

Set `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` to the person or entity operating the
service and `NEXT_PUBLIC_LEGAL_JURISDICTION` to the governing jurisdiction used
in the Terms. The example defaults are `FounderUp` and `India`; replace them if
the actual operator differs before deployment.

### 3. Auth providers

In Supabase → Authentication → Providers, enable **Google** and **GitHub**, and
add `http://localhost:3000/auth/callback` (plus your production URL) as a
redirect URL. Email magic links work out of the box.

### 4. Run

```bash
npm run dev
```

There is no seed data and no demo fixtures. A fresh database renders the real
empty state: an empty leaderboard and `0 / 50` Early Founder spots claimed.
Plan §68 - never launch with fabricated founders, payments or ranks.

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

Each board's #1 shows how long they have held it ("Leading for 3d 4h"). The
database opens a reign whenever #1 really changes hands - a boost past them, a
refund, a suspension, a country change - so a leader who boosts again keeps
their clock (`leader_reigns`, migration 0009).

Founders with zero points are not on the leaderboard; they show as *Unranked*
and appear in search.

---

## Early Founders

The first 50 founders to complete a public profile receive a permanent
`founder_number` and free leaderboard eligibility.

```
Early Founder #17        <- permanent, never changes, never reused
#6 India · #42 Global    <- live rank, moves with Rank Points
```

**How the number is issued.** A Postgres sequence, wired as the column default,
with a `BEFORE INSERT` trigger deriving `is_early_founder` and `is_ranked`:

```sql
founder_number  bigint not null default nextval('founder_number_seq')
is_early_founder = founder_number <= 50   -- derived, never supplied
is_ranked        = is_early_founder or <a payment captured>
```

Putting the rules in a trigger means they hold for *every* insert path — the
onboarding RPC, the service role, a seed script, a psql session — not just the
one written correctly. `nextval()` is atomic and non-transactional, so:

- two simultaneous completions can never receive the same number;
- a deleted account never frees its number (delete #12 at #73, the next is #74);
- authenticating alone reaches none of this, so signing in consumes nothing.

`create_founder_profile` is idempotent. A retried request returns the existing
profile without drawing a new number, serialised by a per-user advisory lock so
a racing retry cannot burn one either.

**Free ranking, no fake payments.** Early Founders appear on the leaderboard at
0 RP through `is_ranked`. No payment row, no ledger entry and no Rank Points are
fabricated. They climb by buying Rank Points like everyone else.

**#51 onward** start Unranked with a fully public, functional profile, and enter
the board from ₹100 / $1.

**The counter** on the homepage reads the sequence, so it flips to the claimed
state on its own at #50 — there is no admin toggle. It counts issued numbers
rather than surviving profiles, because a deleted account must not reopen a
spot.

**Immutability.** `founder_number` and `is_early_founder` are absent from the
`authenticated` UPDATE grant and additionally blocked by trigger, so neither a
client nor a service-role mistake can rewrite history. Suspending a founder
keeps their number.

Tests: `supabase/tests/early_founder_test.sql` and
`supabase/tests/concurrency_test.sh` (the latter runs the 49/50/51 race and a
25-way burst over real parallel connections).

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
- **Never ambiguous.** Once Checkout has taken the money, `/api/boost/verify`
  answers `CONFIRMED` with the real outcome (including when the webhook got
  there first), `PENDING`, or an error - and the boost dialog never shows the
  payment form again for that payment. Nothing is simulated when Razorpay isn't
  configured; checkout is simply unavailable.
- **Your own account only.** A boost always credits the signed-in founder. The
  dialog also sends the profile it is showing, and the order API refuses any
  mismatch rather than charging one founder for another's boost.

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
- **Private columns stay private.** Reads of `profiles` are granted column by
  column (`src/lib/profile-columns.ts` mirrors the list). `auth_user_id`,
  `is_admin` and the country-change metadata are withheld from everyone; a
  founder reads their own row through `current_profile()`. Reach statistics
  (`my_founder_stats()`) only ever return the caller's own numbers.
- **Service role isolation.** Points, tracking and admin operations run through
  `SECURITY DEFINER` functions granted only to `service_role`.
- **Username and country** changes go through guarded functions — reserved-name
  blocking, uniqueness, and a 30-day country cooldown (plan §30), all audited.
  The cooldown lives inside `change_country`, not in a parameter the caller
  controls, and countries are a foreign key to a `countries` table that
  mirrors the picker.
- **URLs** are validated to http/https only; `javascript:` and `data:` are
  rejected - by the app, and again by `CHECK` constraints, so a write straight
  through the Supabase API can't store one either. External links carry
  `rel="noopener noreferrer"`.
- **Founder numbers can't be burned.** `create_founder_profile` validates every
  input before drawing a number, so a rejected call never consumes an Early
  Founder spot.
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

`npm run typecheck` and `npm run lint` cover the code; `npm run build` does both.

### Database suites

The logic that moves money or rank, and the access rules around it, are checked
against a real Postgres rather than mocked:

| Suite | Covers |
| --- | --- |
| `ranking_test.sql` | pricing, USD conversion, idempotent webhooks, tie-breaks, refunds, the daily board |
| `early_founder_test.sql` | founder numbers, the 50-spot cut-off, immutability |
| `security_test.sql` | what `anon` and a signed-in founder can read and write: private columns, reach stats, URL and country validation |
| `leader_test.sql` | when #1 changes hands, and the lead clock that goes with it |
| `concurrency_test.sh` | simultaneous onboarding over real parallel connections |

```bash
psql "$DATABASE_URL" -v allow_destructive=1 -f supabase/tests/ranking_test.sql
psql "$DATABASE_URL" -v allow_destructive=1 -f supabase/tests/early_founder_test.sql
psql "$DATABASE_URL" -v allow_destructive=1 -f supabase/tests/security_test.sql
psql "$DATABASE_URL" -v allow_destructive=1 -f supabase/tests/leader_test.sql
ALLOW_DESTRUCTIVE=1 PGURL="$DATABASE_URL" bash supabase/tests/concurrency_test.sh
```

Every suite truncates all founders, so each refuses to run without that explicit
opt-in. Point them at a local or throwaway database only — never at a database
with real founders. `supabase/tests/README.md` has a scratch-Postgres recipe.

### End-to-end

```bash
npx playwright install chromium   # once
npm run test:e2e
```

Playwright drives a production build in a real browser against real Supabase
services. It needs Docker and the Supabase CLI, and it never touches your
development data:

- `e2e/stack.mjs` starts a **dedicated** Supabase stack from
  `e2e/stack/supabase/config.toml` - its own ports (553xx) and volumes, the
  same migrations - and the suite empties it before every run.
- The app is built once and served twice: on `:3100` with a stand-in Razorpay
  (`e2e/support/razorpay-mock.mjs`), and on `:3101` with no payment keys.
  `RAZORPAY_API_BASE_URL` only takes effect with `rzp_test_` keys, so a live
  deployment can never be pointed at anything but Razorpay.
- Onboarding signs in with the real magic-link email (read from the stack's
  Mailpit); other specs use real `@supabase/ssr` session cookies.

Covered: magic-link sign-in → onboarding → Early Founder → first venture;
boosting your own profile, including the webhook-first race, a still-processing
payment, an unconfirmed payment and an abandoned checkout; refusing a boost
aimed at another founder; a deployment without Razorpay; the #1's lead time on
the podium, the Today board, their profile and dashboard; private columns, reach
stats and URL/country validation attacked straight through the Supabase API;
profile editing; and contracts that keep the SQL and TypeScript country and
column lists in step.

`PW_CHANNEL=chrome` runs against an installed Chrome instead of the bundled
Chromium; `E2E_SKIP_BUILD=1` reuses the last build while iterating on specs.

## What is deliberately not built

Dark mode, internal chat, followers, posts, comments, likes, notifications,
teams, categories, city/state ranking, subscriptions, referrals and badges.
Plan §63. The only question worth answering first is whether founders will pay
to climb.
