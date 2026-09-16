import postgres from "postgres";
import { stack } from "./env";

/**
 * Direct SQL against the dedicated E2E database, for the setup and checks
 * PostgREST can't express (sequences, grants). Idle connections close quickly
 * so workers exit cleanly.
 */
export const db = postgres(stack.dbUrl, {
  max: 1,
  idle_timeout: 1,
  onnotice: () => {},
});

export async function foundersIssued(): Promise<number> {
  const [row] = await db<{ last_value: string | null }[]>`
    select last_value from pg_sequences
     where schemaname = 'public' and sequencename = 'founder_number_seq'`;
  return Number(row?.last_value ?? 0);
}
