# Database tests

These cover the logic that decides who ranks where, who gets Rank Points, and
what each role may read or write. They are the cases where a bug costs real
money, leaks private data or corrupts the leaderboard, so they run against a
real Postgres rather than mocks.

Every suite truncates all founders, so each refuses to run without an explicit
opt-in (`-v allow_destructive=1`, or `ALLOW_DESTRUCTIVE=1` for the shell
script). Never point them at a database with real founders.

## Against a local Supabase

```bash
npx supabase start
export PGURL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

This is your development database - the suites will empty it.

## Against a scratch Postgres

`local_stub.sql` provides minimal stand-ins for the Supabase-managed pieces
(`auth.users`, `auth.uid()`, the `anon` / `authenticated` / `service_role` roles
and a storage schema) so the migrations can run anywhere.

```bash
docker run -d --name founderup-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=founderup -p 55432:5432 postgres:17-alpine

export PGURL="postgresql://postgres:postgres@127.0.0.1:55432/founderup"
psql "$PGURL" -f supabase/tests/local_stub.sql
for f in supabase/migrations/*.sql; do psql "$PGURL" -v ON_ERROR_STOP=1 -f "$f"; done
```

## Running

```bash
psql "$PGURL" -v allow_destructive=1 -f supabase/tests/ranking_test.sql
psql "$PGURL" -v allow_destructive=1 -f supabase/tests/early_founder_test.sql
psql "$PGURL" -v allow_destructive=1 -f supabase/tests/security_test.sql
psql "$PGURL" -v allow_destructive=1 -f supabase/tests/leader_test.sql
ALLOW_DESTRUCTIVE=1 PGURL="$PGURL" bash supabase/tests/concurrency_test.sh
```

Each suite rebuilds its own fixtures, so all are safe to re-run.
`security_test.sql` and `leader_test.sql` print one `ok` / `FAIL` line per
check, so `grep FAIL` is their whole verdict; the others print each result
beside its expected value.

## What is covered

`ranking_test.sql`

| # | Case | Why it matters |
| --- | --- | --- |
| 1 | INR boost awards 1 RP per rupee | The core pricing rule |
| 2 | USD boost uses Razorpay `base_amount` | Stops currency arbitrage |
| 3 | Duplicate webhook is a no-op | Razorpay retries must be free |
| 4 | Unknown order rejected | No points without our own order |
| 5 | Tie-break by who scored first | Deterministic ordering |
| 6 | Country leaderboard | Regional scope |
| 7 | Unranked founders excluded | "Unranked", not rank #N |
| 8 | `next_rank_gap` | "301 RP to take #2" is correct with ties |
| 9 | Today leaderboard + UTC day | Daily board resets identically for all |
| 10 | Forced refund claws points back | Bank reversals must not leave points |
| 11 | Double refund is a no-op | Repeated dispute webhooks |
| 12 | Refund also reduces today's score | Daily board stays consistent |
| 13 | Rounding down | ₹100.99 equivalent gives 100 RP |
| 14 | Reserved and duplicate usernames | Route collisions and impersonation |
| 15 | Venture cap of 5 | Profile stays a profile |
| 16 | Country change cooldown | Blunts regional gaming |
| 17 | Search by name, username, venture | Discovery |
| 18 | Activity events generated | Feed is system-generated only |

`early_founder_test.sql` and `concurrency_test.sh` cover founder numbers: issued
only on onboarding, never reused, #50 / #51 under a real race, immutable.

`security_test.sql` runs every check as the role that would really make the
request:

| Area | Checks |
| --- | --- |
| Private columns | `anon` reads public profile columns but not `auth_user_id`, `is_admin`, `country_changed_at` or `profile_completed_at` - not even in a filter; a founder reads their own private row only via `current_profile()` |
| Reach stats | `my_founder_stats()` refused to `anon`, scoped to the caller; `founder_stats(uuid)` is gone |
| Policies | ventures, payments, ledger, orders and reports still resolve the caller without reading `auth_user_id` |
| Protected columns | score, rank, admin flag and country can't be written directly |
| Links | `javascript:`, `data:`, host-less, whitespace and non-http links refused on every URL column, whichever path writes them |
| Countries | `ZZ` refused everywhere; the cooldown can't be passed in; changes inside it are refused |
| Founder numbers | a rejected onboarding call draws no number |

`leader_test.sql` covers the lead clock on each board's #1: it starts when #1
is taken, carries on when the leader boosts again, and changes hands on a
bigger boost, a refund, a suspension, a country change or a deleted account -
on the all-time and Today boards, globally and per country - while the reign
history itself stays private.
