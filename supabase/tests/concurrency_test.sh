#!/usr/bin/env bash
# FounderUp - concurrent onboarding completion (required test 8)
#
# Two founders finishing onboarding at the same instant must receive two
# different numbers. With 49 already issued, exactly one becomes Early Founder
# #50 and the other becomes #51.
#
# This uses real parallel connections rather than simulating the race in one
# session, because the thing under test is precisely what happens when two
# backends call nextval() at once.
#
#   PGURL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     bash supabase/tests/concurrency_test.sh

set -euo pipefail
PGURL="${PGURL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# This truncates auth.users and every profile. Never point it at a database
# with real founders.
if [ "${ALLOW_DESTRUCTIVE:-}" != "1" ]; then
  echo "REFUSING TO RUN: this suite truncates all founders."
  echo "For a local or throwaway database only, re-run with ALLOW_DESTRUCTIVE=1."
  exit 1
fi
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

q() { psql "$PGURL" -v ON_ERROR_STOP=1 -tAq -c "$1"; }

fail=0
check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf '  ok   %-52s %s\n' "$1" "$2"
  else
    printf '  FAIL %-52s got %s, expected %s\n' "$1" "$2" "$3"
    fail=1
  fi
}

echo "Resetting fixtures..."
q "truncate auth.users cascade;" > /dev/null
q "truncate public.activity_events;" > /dev/null
q "select setval('public.founder_number_seq', 1, false);" > /dev/null

# Fill to exactly 49 completed founders.
q "
do \$\$
declare v_uid uuid;
begin
  for i in 1..49 loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, 'seed'||i||'@test.local');
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    perform public.create_founder_profile('seedfounder'||lpad(i::text,3,'0'),
                                          'Seed '||i, 'IN', null);
  end loop;
end \$\$;" > /dev/null

check "founders completed before the race" "$(q "select count(*) from public.profiles;")" "49"
check "numbers issued so far" "$(q "select last_value from pg_sequences where sequencename='founder_number_seq';")" "49"

# Two users who have authenticated but not completed onboarding.
UID_A=$(q "insert into auth.users (id, email) values (gen_random_uuid(),'racer_a@test.local') returning id;")
UID_B=$(q "insert into auth.users (id, email) values (gen_random_uuid(),'racer_b@test.local') returning id;")

# Both sessions block until the same wall-clock instant, then complete.
TARGET=$(q "select (clock_timestamp() + interval '3 seconds')::text;")

race() { # race <uid> <username> <outfile>
  psql "$PGURL" -v ON_ERROR_STOP=1 -tAq -o "$3" <<SQL &
select pg_sleep(greatest(0, extract(epoch from (timestamptz '$TARGET' - clock_timestamp()))));
select set_config('request.jwt.claim.sub', '$1', false);
select public.create_founder_profile('$2', 'Racer', 'IN', null)::text;
SQL
}

echo "Firing two completions simultaneously..."
race "$UID_A" "racerone" "$OUT/a.txt"
race "$UID_B" "racertwo" "$OUT/b.txt"
wait

NUM_A=$(q "select founder_number from public.profiles where username='racerone';")
NUM_B=$(q "select founder_number from public.profiles where username='racertwo';")
EARLY_A=$(q "select is_early_founder from public.profiles where username='racerone';")
EARLY_B=$(q "select is_early_founder from public.profiles where username='racertwo';")

echo "  racerone -> #$NUM_A (early=$EARLY_A)"
echo "  racertwo -> #$NUM_B (early=$EARLY_B)"

check "the two numbers differ" "$( [ "$NUM_A" != "$NUM_B" ] && echo yes || echo no )" "yes"
check "one is 50, one is 51" \
  "$(q "select case when least($NUM_A,$NUM_B)=50 and greatest($NUM_A,$NUM_B)=51 then 'yes' else 'no' end;")" "yes"
check "exactly one Early Founder #50" \
  "$(q "select count(*) from public.profiles where founder_number=50 and is_early_founder;")" "1"
check "#51 is not an Early Founder" \
  "$(q "select count(*) from public.profiles where founder_number=51 and not is_early_founder;")" "1"
check "#51 starts unranked" \
  "$(q "select count(*) from public.profiles where founder_number=51 and not is_ranked;")" "1"
check "total Early Founders" "$(q "select count(*) from public.profiles where is_early_founder;")" "50"
check "all spots now claimed" "$(q "select all_claimed from public.early_founder_status();")" "t"

# A wider burst, to make sure the guarantee is not an artefact of n=2.
echo ""
echo "Stress: 25 simultaneous completions..."
q "truncate auth.users cascade;" > /dev/null
q "select setval('public.founder_number_seq', 1, false);" > /dev/null

BURST_TARGET=$(q "select (clock_timestamp() + interval '3 seconds')::text;")
for i in $(seq 1 25); do
  U=$(q "insert into auth.users (id,email) values (gen_random_uuid(),'burst$i@test.local') returning id;")
  psql "$PGURL" -tAq -o /dev/null <<SQL &
select pg_sleep(greatest(0, extract(epoch from (timestamptz '$BURST_TARGET' - clock_timestamp()))));
select set_config('request.jwt.claim.sub', '$U', false);
select public.create_founder_profile('burst$(printf '%03d' "$i")', 'Burst $i', 'IN', null)::text;
SQL
done
wait

check "25 profiles created" "$(q "select count(*) from public.profiles;")" "25"
check "25 distinct numbers" "$(q "select count(distinct founder_number) from public.profiles;")" "25"
check "numbers are 1..25 with no gaps" \
  "$(q "select case when min(founder_number)=1 and max(founder_number)=25 then 'yes' else 'no' end from public.profiles;")" "yes"

echo ""
if [ "$fail" -eq 0 ]; then echo "All concurrency checks passed."; else echo "FAILURES ABOVE"; exit 1; fi
