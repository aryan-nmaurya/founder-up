import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/legal-page";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `About ${APP_NAME}`,
  description: `What ${APP_NAME} is, how ranking works, and what Rank Points mean.`,
  alternates: { canonical: "/about" },
};

/** Plan §38 - readable in under two minutes. */
export default function AboutPage() {
  return (
    <LegalPage title={`About ${APP_NAME}`}>
      <P>
        {APP_NAME} is a public leaderboard and discovery network for founders.
        You create a profile, show what you have built or what business you run,
        and appear on the leaderboard. Visitors browse founders globally or by
        country, see what they are working on, and contact them directly.
      </P>

      <H2>Early Founders</H2>
      <P>
        The first 50 founders to complete a public profile become Early Founders.
        Each keeps a permanent number — Early Founder #1 through #50 — shown on
        their profile alongside their live rank. The number is assigned when the
        profile is created, never changes, and is never reissued if someone
        leaves.
      </P>
      <P>
        Early Founders enter the leaderboard without paying. They hold no Rank
        Points until they buy some, so they start at the bottom of the board and
        climb the same way everyone else does. Once all 50 numbers are issued,
        profiles stay free for everyone and the ranked board is entered from
        ₹100 / $1.
      </P>

      <H2>What Rank Points mean</H2>
      <P>
        One Rank Point is one rupee of captured payment value. A ₹500 boost adds
        500 RP. Payments in other currencies are converted to their INR value
        first, using the conversion the payment gateway settles at, so no
        currency has an advantage. Fractions are rounded down.
      </P>

      <H2>Global and country rankings</H2>
      <P>
        There are two scopes: Global and Country. Your country ranking comes from
        the country on your profile, which you can change once every 30 days. Each
        scope has an all-time board and a daily board. The daily board resets at
        00:00 UTC, the same moment for every visitor, so a new founder always has
        something they can realistically win.
      </P>
      <P>
        When two founders have the same score, whoever reached it first stays
        above.
      </P>

      <H2>What profiles are for</H2>
      <P>
        A profile shows who you are, what you are building, and one link for
        people to reach you. {APP_NAME} has no inbox — the Connect button opens
        whichever destination you chose. It is deliberately not a résumé site.
      </P>

      <H2>Payments</H2>
      <P>
        Boosts are one-off payments processed by Razorpay. There are no
        subscriptions and no plans. Rank Points are delivered immediately and are
        non-refundable — see the{" "}
        <Link href="/refunds" className="underline underline-offset-2 hover:text-fg">
          refund policy
        </Link>
        .
      </P>

      <H2>What we don&apos;t do</H2>
      <UL>
        <li>No fake founders and no fabricated ranks.</li>
        <li>No posts, comments, likes or feed.</li>
        <li>No selling your data.</li>
        <li>No hiding the fact that ranking is paid.</li>
      </UL>

      <P>
        <Link href="/" className="underline underline-offset-2 hover:text-fg">
          Back to the leaderboard
        </Link>
      </P>
    </LegalPage>
  );
}
