import { expect, test } from "@playwright/test";
import { allCountries } from "../src/lib/countries";
import { PUBLIC_PROFILE_COLUMN_LIST } from "../src/lib/profile-columns";
import { admin } from "./support/supabase";
import { db } from "./support/db";

// Lists that live in both TypeScript and SQL. Drift either way is a bug: a
// country the picker offers but the database refuses, or a column the app
// selects that anon may not read.

test("the database accepts exactly the countries the app offers", async () => {
  const { data, error } = await admin.from("countries").select("code");
  expect(error).toBeNull();
  const database = (data ?? []).map((row) => row.code as string).sort();
  const app = allCountries().map((c) => c.code).sort();
  expect(database).toEqual(app);
});

test("anon may read exactly the profile columns the app selects", async () => {
  const rows = await db<{ column_name: string }[]>`
    select column_name from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'profiles'
       and grantee = 'anon' and privilege_type = 'SELECT'`;
  expect(rows.map((r) => r.column_name).sort()).toEqual([...PUBLIC_PROFILE_COLUMN_LIST].sort());
});
