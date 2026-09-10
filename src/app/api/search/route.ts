import { NextResponse, type NextRequest } from "next/server";
import { searchFounders } from "@/lib/db";
import { isValidCountry } from "@/lib/countries";
import { clientKey, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/** Plan §44 - name, username or venture. Country is the only filter. */
export async function GET(request: NextRequest) {
  const limit = rateLimit(
    await clientKey("search"),
    RATE_LIMITS.search.limit,
    RATE_LIMITS.search.window,
  );
  if (!limit.ok) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const rawCountry = request.nextUrl.searchParams.get("country");
  const country =
    rawCountry && isValidCountry(rawCountry) ? rawCountry.toUpperCase() : null;

  if (query.trim().length < 2) return NextResponse.json({ results: [] });

  const results = await searchFounders(query, country, 25);
  return NextResponse.json({ results });
}
