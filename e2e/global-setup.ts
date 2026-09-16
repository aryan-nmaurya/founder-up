import postgres from "postgres";
import { stack } from "./support/env";

/**
 * The E2E stack exists only for this suite, so every run starts it empty: no
 * founders, no payments, founder numbers from #1. The development database is
 * a different stack on different ports and is never touched.
 */
export default async function globalSetup() {
  const sql = postgres(stack.dbUrl, { max: 1, onnotice: () => {} });
  try {
    // Objects from the newest migrations: if they're missing, the stack is stale.
    const [{ ready }] = await sql<{ ready: boolean }[]>`
      select to_regprocedure('public.current_founder_id()') is not null
         and to_regprocedure('public.current_leader(text, text)') is not null as ready`;
    if (!ready) {
      throw new Error("The E2E database is missing migrations. Run `node e2e/stack.mjs`.");
    }

    await sql`truncate auth.users cascade`;
    await sql`truncate public.activity_events, public.webhook_events, public.audit_logs,
                       public.click_events, public.profile_views`;
    await sql`select setval('public.founder_number_seq', 1, false)`;
  } finally {
    await sql.end();
  }
}
