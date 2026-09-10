# Ranking and payment tests

`ranking_test.sql` covers the logic that decides who ranks where and who gets
Rank Points. These are the cases where a bug costs real money or corrupts the
leaderboard, so they are checked against a real Postgres rather than mocked.

## Against a local Supabase

```bash
npx supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/ranking_test.sql
```

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
psql "$PGURL" -f supabase/tests/ranking_test.sql
```

The suite truncates and reseeds, so it is safe to re-run. Never point it at a
database with real founders.

## What is covered

| # | Case | Why it matters |
| --- | --- | --- |
| 1 | INR boost awards 1 RP per rupee | The core pricing rule |
| 2 | USD boost uses Razorpay `base_amount` | Stops currency arbitrage |
| 3 | Duplicate webhook is a no-op | Razorpay retries must be free |
| 4 | Unknown order rejected | No points without our own order |
| 5 | Tie-break by who scored first | Deterministic ordering |
| 6 | Country leaderboard | Regional scope |
| 7 | Zero-point founders excluded | "Unranked", not rank #N |
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
