import Link from "next/link";
export function Brand() {
  return <Link href="/" className="brand" aria-label="FounderUp home"><span className="brand-mark" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M5 17V11M11 17V7M17 17V3" stroke="currentColor" strokeWidth="3"/><path d="M4 21H21" stroke="currentColor" strokeWidth="2"/></svg></span>FounderUp</Link>;
}
