import type { ActivityEvent, LeaderboardRow, Profile, Venture } from "@/types/db";

export interface ExtendedLeaderboardRow extends LeaderboardRow {
  rank_change_today?: number; // e.g. +3, -1, 0, or null for new
  leading_duration?: string; // e.g. "8h 42m" for #1
  gap_to_next?: number; // RP gap to next rank or #1
}

export const MOCK_COMMUNITY_STATS = {
  totalFounders: 186,
  onlineNow: 24,
  // Early Founder counts come from the database (early_founder_status),
  // never from here - a hardcoded tally would misreport availability.
};

export const MOCK_FOUNDERS_DATA: Array<{
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  country_code: string;
  headline: string;
  bio: string;
  website_url: string;
  x_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  contact_type: "WEBSITE" | "X" | "LINKEDIN" | "EMAIL";
  contact_value: string | null;
  is_verified: boolean;
  is_early_founder: boolean;
  all_time_points: number;
  today_points: number;
  rank_change_today: number;
  leading_duration?: string;
  ventures: Array<{
    id: string;
    type: "PROJECT" | "BUSINESS";
    name: string;
    description: string;
    url: string | null;
  }>;
}> = [
  {
    id: "f-1",
    username: "alexmorgan",
    full_name: "Alex Morgan",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    country_code: "US",
    headline: "Building AI developer tools · Ex-Stripe engineer",
    bio: "Obsessed with developer ergonomics and real-time AI toolchains. Building Acme AI to automate integration testing and Promptbook for versioning system prompts.",
    website_url: "https://acmeai.dev",
    x_url: "https://x.com/alexmorgan",
    linkedin_url: "https://linkedin.com/in/alexmorgan",
    github_url: "https://github.com/alexmorgan",
    contact_type: "X",
    contact_value: "alexmorgan",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 12480,
    today_points: 4400,
    rank_change_today: 0,
    leading_duration: "8h 42m",
    ventures: [
      {
        id: "v-1",
        type: "BUSINESS",
        name: "Acme AI",
        description: "Autonomous end-to-end integration tests for LLM applications.",
        url: "https://acmeai.dev",
      },
      {
        id: "v-2",
        type: "PROJECT",
        name: "Promptbook",
        description: "Git-backed collaborative prompt engineering platform for teams.",
        url: "https://github.com/alexmorgan/promptbook",
      },
    ],
  },
  {
    id: "f-2",
    username: "sarahchen",
    full_name: "Sarah Chen",
    avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
    country_code: "SG",
    headline: "Founder of DesignFlow · Product designer turned founder",
    bio: "Bridging the gap between Figma components and production code. Bootstrapped DesignFlow from 0 to $25k MRR.",
    website_url: "https://designflow.io",
    x_url: "https://x.com/sarahchen",
    linkedin_url: "https://linkedin.com/in/sarahchen",
    github_url: null,
    contact_type: "WEBSITE",
    contact_value: null,
    is_verified: true,
    is_early_founder: true,
    all_time_points: 12300,
    today_points: 3950,
    rank_change_today: 1,
    ventures: [
      {
        id: "v-3",
        type: "BUSINESS",
        name: "DesignFlow",
        description: "Zero-meeting design handoff & automated React tokens.",
        url: "https://designflow.io",
      },
    ],
  },
  {
    id: "f-3",
    username: "aryansharma",
    full_name: "Aryan Sharma",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    country_code: "IN",
    headline: "Building FounderUp & ABC Labs · Indie maker",
    bio: "Shipping rapid products across web, devtools, and creator tech. Focused on transparent public leaderboards and high-trust monetization.",
    website_url: "https://founderup.dev",
    x_url: "https://x.com/aryansharma",
    linkedin_url: "https://linkedin.com/in/aryansharma",
    github_url: "https://github.com/aryansharma",
    contact_type: "X",
    contact_value: "aryansharma",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 11850,
    today_points: 3100,
    rank_change_today: 2,
    ventures: [
      {
        id: "v-4",
        type: "PROJECT",
        name: "FounderUp",
        description: "The competitive public leaderboard for ambitious founders.",
        url: "https://founderup.dev",
      },
      {
        id: "v-5",
        type: "BUSINESS",
        name: "ABC Labs",
        description: "Applied generative AI micro-tools for engineering leaders.",
        url: "https://abclabs.ai",
      },
    ],
  },
  {
    id: "f-4",
    username: "marcusvance",
    full_name: "Marcus Vance",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    country_code: "GB",
    headline: "CEO at DevRelay · Cloud edge networking",
    bio: "Built distributed systems across London and Berlin. Now tackling ultra-low latency webhook delivery.",
    website_url: "https://devrelay.net",
    x_url: "https://x.com/marcusvance",
    linkedin_url: "https://linkedin.com/in/marcusvance",
    github_url: "https://github.com/marcusvance",
    contact_type: "LINKEDIN",
    contact_value: "marcusvance",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 9420,
    today_points: 1800,
    rank_change_today: -1,
    ventures: [
      {
        id: "v-6",
        type: "BUSINESS",
        name: "DevRelay",
        description: "Sub-millisecond reliable webhook relay with automatic retries.",
        url: "https://devrelay.net",
      },
    ],
  },
  {
    id: "f-5",
    username: "elenarostova",
    full_name: "Elena Rostova",
    avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
    country_code: "DE",
    headline: "Founder at Kohlen · Industrial Carbon Ledger",
    bio: "Hardware and climate software pioneer. Helping European mid-sized factories audit and reduce carbon output.",
    website_url: "https://kohlen.earth",
    x_url: "https://x.com/elenarostova",
    linkedin_url: "https://linkedin.com/in/elenarostova",
    github_url: null,
    contact_type: "EMAIL",
    contact_value: "elena@kohlen.earth",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 8750,
    today_points: 1250,
    rank_change_today: 3,
    ventures: [
      {
        id: "v-7",
        type: "BUSINESS",
        name: "Kohlen",
        description: "Plug-and-play IoT sensors & automated ESG compliance auditing.",
        url: "https://kohlen.earth",
      },
    ],
  },
  {
    id: "f-6",
    username: "rahulverma",
    full_name: "Rahul Verma",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
    country_code: "IN",
    headline: "Solo founder of Invoicely · $18k MRR",
    bio: "Full-stack craftsman building dead-simple invoicing software for global contractors and freelance agencies.",
    website_url: "https://invoicely.app",
    x_url: "https://x.com/rahulverma",
    linkedin_url: "https://linkedin.com/in/rahulverma",
    github_url: "https://github.com/rahulverma",
    contact_type: "X",
    contact_value: "rahulverma",
    is_verified: false,
    is_early_founder: true,
    all_time_points: 7600,
    today_points: 2100,
    rank_change_today: 4,
    ventures: [
      {
        id: "v-8",
        type: "PROJECT",
        name: "Invoicely",
        description: "Multi-currency client invoicing with instant payment links.",
        url: "https://invoicely.app",
      },
    ],
  },
  {
    id: "f-7",
    username: "davidpark",
    full_name: "David Park",
    avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80",
    country_code: "CA",
    headline: "Building Loomis AI · Conversational CRM for sales",
    bio: "Vancouver-based builder. Automating meeting notes into synchronized HubSpot and Salesforce workflows.",
    website_url: "https://loomis.ai",
    x_url: "https://x.com/davidpark",
    linkedin_url: "https://linkedin.com/in/davidpark",
    github_url: null,
    contact_type: "WEBSITE",
    contact_value: null,
    is_verified: true,
    is_early_founder: true,
    all_time_points: 6890,
    today_points: 800,
    rank_change_today: -2,
    ventures: [
      {
        id: "v-9",
        type: "BUSINESS",
        name: "Loomis AI",
        description: "Real-time AI copilot during high-stakes B2B discovery calls.",
        url: "https://loomis.ai",
      },
    ],
  },
  {
    id: "f-8",
    username: "priyanair",
    full_name: "Priya Nair",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    country_code: "IN",
    headline: "Founder at Vitals · Health data interoperability",
    bio: "Biotech engineer working on standardized HL7 FHIR APIs for modern diagnostic labs across South Asia.",
    website_url: "https://vitalsdata.org",
    x_url: "https://x.com/priyanair",
    linkedin_url: "https://linkedin.com/in/priyanair",
    github_url: null,
    contact_type: "LINKEDIN",
    contact_value: "priyanair",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 5400,
    today_points: 1500,
    rank_change_today: 1,
    ventures: [
      {
        id: "v-10",
        type: "BUSINESS",
        name: "Vitals",
        description: "Unified patient health record APIs for clinic networks.",
        url: "https://vitalsdata.org",
      },
    ],
  },
  {
    id: "f-9",
    username: "lucasdubois",
    full_name: "Lucas Dubois",
    avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
    country_code: "FR",
    headline: "Building Typefast · Next-gen typography toolkit",
    bio: "Type nerd and frontend engineer in Paris. Empowering web designers to craft custom variable fonts without font-forge.",
    website_url: "https://typefast.design",
    x_url: "https://x.com/lucasdubois",
    linkedin_url: "https://linkedin.com/in/lucasdubois",
    github_url: "https://github.com/lucasdubois",
    contact_type: "X",
    contact_value: "lucasdubois",
    is_verified: false,
    is_early_founder: true,
    all_time_points: 4950,
    today_points: 450,
    rank_change_today: 0,
    ventures: [
      {
        id: "v-11",
        type: "PROJECT",
        name: "Typefast",
        description: "Interactive browser studio for styling and tuning variable fonts.",
        url: "https://typefast.design",
      },
    ],
  },
  {
    id: "f-10",
    username: "anika_patel",
    full_name: "Anika Patel",
    avatar_url: "https://images.unsplash.com/photo-1534751516642-a171ed281691?w=200&auto=format&fit=crop&q=80",
    country_code: "IN",
    headline: "Founder of CloudPulse · SRE observability for startups",
    bio: "Bengaluru builder. Making Kubernetes cost management and alerting zero-headache for early-stage engineering squads.",
    website_url: "https://cloudpulse.io",
    x_url: "https://x.com/anikapatel",
    linkedin_url: "https://linkedin.com/in/anikapatel",
    github_url: "https://github.com/anikapatel",
    contact_type: "X",
    contact_value: "anikapatel",
    is_verified: true,
    is_early_founder: true,
    all_time_points: 4320,
    today_points: 920,
    rank_change_today: 5,
    ventures: [
      {
        id: "v-12",
        type: "BUSINESS",
        name: "CloudPulse",
        description: "Cloud observability and cost-reduction alerts via Slack.",
        url: "https://cloudpulse.io",
      },
    ],
  },
  {
    id: "f-11",
    username: "tomokafor",
    full_name: "Tom Okafor",
    avatar_url: "https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=200&auto=format&fit=crop&q=80",
    country_code: "NG",
    headline: "Founder at Kobo · Fintech infrastructure for African SMEs",
    bio: "Lagos-based fintech engineer. Enabling merchants across 6 countries to accept instant mobile money and card payments.",
    website_url: "https://kobopay.co",
    x_url: "https://x.com/tomokafor",
    linkedin_url: "https://linkedin.com/in/tomokafor",
    github_url: null,
    contact_type: "WEBSITE",
    contact_value: null,
    is_verified: true,
    is_early_founder: true,
    all_time_points: 3880,
    today_points: 600,
    rank_change_today: -1,
    ventures: [
      {
        id: "v-13",
        type: "BUSINESS",
        name: "Kobo",
        description: "Omnichannel checkout and settlement for West African retail.",
        url: "https://kobopay.co",
      },
    ],
  },
  {
    id: "f-12",
    username: "oliverlind",
    full_name: "Oliver Lindqvist",
    avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80",
    country_code: "SE",
    headline: "Building AudioCraft · AI vocal synthesis for games",
    bio: "Sound designer turned software entrepreneur in Stockholm. Empowering indie game studios to cast procedural NPC voices.",
    website_url: "https://audiocraft.se",
    x_url: "https://x.com/oliverlind",
    linkedin_url: "https://linkedin.com/in/oliverlind",
    github_url: "https://github.com/oliverlind",
    contact_type: "X",
    contact_value: "oliverlind",
    is_verified: false,
    is_early_founder: true,
    all_time_points: 3150,
    today_points: 350,
    rank_change_today: 2,
    ventures: [
      {
        id: "v-14",
        type: "PROJECT",
        name: "AudioCraft",
        description: "Low-latency voice generator plugin for Unity and Unreal Engine 5.",
        url: "https://audiocraft.se",
      },
    ],
  },
  {
    id: "f-13",
    username: "maya_tanaka",
    full_name: "Maya Tanaka",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    country_code: "JP",
    headline: "CEO of BentoGrid · Minimal productivity workspace",
    bio: "Tokyo-based creator crafting focused desktop utilities for deep work.",
    website_url: "https://bentogrid.jp",
    x_url: "https://x.com/mayatanaka",
    linkedin_url: "https://linkedin.com/in/mayatanaka",
    github_url: null,
    contact_type: "WEBSITE",
    contact_value: null,
    is_verified: true,
    is_early_founder: true,
    all_time_points: 2900,
    today_points: 750,
    rank_change_today: 3,
    ventures: [
      {
        id: "v-15",
        type: "BUSINESS",
        name: "BentoGrid",
        description: "Modular daily dashboard for remote software teams.",
        url: "https://bentogrid.jp",
      },
    ],
  },
  {
    id: "f-14",
    username: "dev_siddharth",
    full_name: "Siddharth Rao",
    avatar_url: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&auto=format&fit=crop&q=80",
    country_code: "IN",
    headline: "Building Cacheflow · Edge Redis caching service",
    bio: "Hyderabad builder. Low latency caching without the cloud bill surprise.",
    website_url: "https://cacheflow.cloud",
    x_url: "https://x.com/siddharthrao",
    linkedin_url: null,
    github_url: "https://github.com/siddharthrao",
    contact_type: "X",
    contact_value: "siddharthrao",
    is_verified: false,
    is_early_founder: true,
    all_time_points: 2450,
    today_points: 250,
    rank_change_today: 0,
    ventures: [
      {
        id: "v-16",
        type: "PROJECT",
        name: "Cacheflow",
        description: "Serverless distributed cache with millisecond replication.",
        url: "https://cacheflow.cloud",
      },
    ],
  },
  {
    id: "f-15",
    username: "mateo_silva",
    full_name: "Mateo Silva",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
    country_code: "BR",
    headline: "Founder at PixiePay · Instant payments in LatAm",
    bio: "São Paulo builder scaling financial connectivity for digital storefronts.",
    website_url: "https://pixiepay.com.br",
    x_url: "https://x.com/mateosilva",
    linkedin_url: "https://linkedin.com/in/mateosilva",
    github_url: null,
    contact_type: "WEBSITE",
    contact_value: null,
    is_verified: true,
    is_early_founder: true,
    all_time_points: 2100,
    today_points: 500,
    rank_change_today: 1,
    ventures: [
      {
        id: "v-17",
        type: "BUSINESS",
        name: "PixiePay",
        description: "Pix payment SDK with 99.99% uptime for Brazilian ecommerce.",
        url: "https://pixiepay.com.br",
      },
    ],
  },
];

export const MOCK_ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: 1,
    founder_id: "f-3",
    type: "ENTERED_TOP_10",
    metadata: { scope: "India" },
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    profiles: {
      username: "aryansharma",
      full_name: "Aryan Sharma",
      country_code: "IN",
    },
  },
  {
    id: 2,
    founder_id: "f-1",
    type: "REACHED_NUMBER_ONE",
    metadata: { scope: "Global" },
    created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    profiles: {
      username: "alexmorgan",
      full_name: "Alex Morgan",
      country_code: "US",
    },
  },
  {
    id: 3,
    founder_id: "f-2",
    type: "BOOSTED",
    metadata: { points: 500 },
    created_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    profiles: {
      username: "sarahchen",
      full_name: "Sarah Chen",
      country_code: "SG",
    },
  },
  {
    id: 4,
    founder_id: "f-6",
    type: "RANK_UP",
    metadata: { from: 10, to: 6, scope: "Global" },
    created_at: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    profiles: {
      username: "rahulverma",
      full_name: "Rahul Verma",
      country_code: "IN",
    },
  },
  {
    id: 5,
    founder_id: "f-10",
    type: "JOINED",
    metadata: {},
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    profiles: {
      username: "anika_patel",
      full_name: "Anika Patel",
      country_code: "IN",
    },
  },
  {
    id: 6,
    founder_id: "f-5",
    type: "RANK_UP",
    metadata: { from: 8, to: 5, scope: "Global" },
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    profiles: {
      username: "elenarostova",
      full_name: "Elena Rostova",
      country_code: "DE",
    },
  },
];

/** Stable stand-in for founder_number, keyed to fixture order. */
const MOCK_FOUNDER_NUMBERS = new Map(
  MOCK_FOUNDERS_DATA.map((f, index) => [f.id, index + 1] as const),
);

export function getMockLeaderboardRows({
  period = "ALL_TIME",
  country = null,
  limit = 50,
  offset = 0,
}: {
  period?: "ALL_TIME" | "TODAY";
  country?: string | null;
  limit?: number;
  offset?: number;
}): ExtendedLeaderboardRow[] {
  let list = [...MOCK_FOUNDERS_DATA];

  if (country) {
    list = list.filter((f) => f.country_code.toUpperCase() === country.toUpperCase());
  }

  list.sort((a, b) => {
    const pointsA = period === "TODAY" ? a.today_points : a.all_time_points;
    const pointsB = period === "TODAY" ? b.today_points : b.all_time_points;
    return pointsB - pointsA;
  });

  const sliced = list.slice(offset, offset + limit);

  return sliced.map((founder, index) => {
    const rank = offset + index + 1;
    const points = period === "TODAY" ? founder.today_points : founder.all_time_points;
    const primaryVenture = founder.ventures[0];

    let gapToNext: number | undefined;
    if (rank > 1) {
      const prevFounder = list[rank - 2];
      const prevPoints = period === "TODAY" ? prevFounder.today_points : prevFounder.all_time_points;
      gapToNext = prevPoints - points + 1;
    }

    return {
      id: founder.id,
      rank,
      username: founder.username,
      full_name: founder.full_name,
      avatar_url: founder.avatar_url,
      country_code: founder.country_code,
      headline: founder.headline,
      venture_name: primaryVenture?.name ?? null,
      venture_url: primaryVenture?.url ?? null,
      points,
      is_verified: founder.is_verified,
      // Position in the fixture list stands in for the real sequence value.
      founder_number: MOCK_FOUNDER_NUMBERS.get(founder.id) ?? 0,
      is_early_founder: founder.is_early_founder,
      rank_change_today: founder.rank_change_today,
      leading_duration: rank === 1 ? founder.leading_duration ?? "8h 42m" : undefined,
      gap_to_next: gapToNext,
    };
  });
}

export function getMockLeaderboardCount(
  period: "ALL_TIME" | "TODAY",
  country: string | null,
): number {
  if (country) {
    return MOCK_FOUNDERS_DATA.filter(
      (f) => f.country_code.toUpperCase() === country.toUpperCase(),
    ).length;
  }
  return MOCK_FOUNDERS_DATA.length;
}

export function getMockActiveCountries(): string[] {
  const codes = new Set(MOCK_FOUNDERS_DATA.map((f) => f.country_code));
  return Array.from(codes);
}

export function getMockProfileByUsername(username: string): Profile | null {
  const f = MOCK_FOUNDERS_DATA.find(
    (item) => item.username.toLowerCase() === username.toLowerCase(),
  );
  if (!f) return null;

  return {
    id: f.id,
    auth_user_id: `auth-${f.id}`,
    username: f.username,
    full_name: f.full_name,
    avatar_url: f.avatar_url,
    country_code: f.country_code,
    headline: f.headline,
    bio: f.bio,
    website_url: f.website_url,
    x_url: f.x_url,
    linkedin_url: f.linkedin_url,
    github_url: f.github_url,
    contact_type: f.contact_type,
    contact_value: f.contact_value,
    is_verified: f.is_verified,
    is_admin: false,
    is_suspended: false,
    total_rank_points: f.all_time_points,
    today_rank_points: f.today_points,
    created_at: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    is_early_founder: f.is_early_founder,
  } as unknown as Profile;
}

export function getMockVentures(founderId: string): Venture[] {
  const f = MOCK_FOUNDERS_DATA.find((item) => item.id === founderId);
  if (!f) return [];
  return f.ventures.map((v, i) => ({
    id: v.id,
    founder_id: founderId,
    type: v.type,
    name: v.name,
    description: v.description,
    url: v.url,
    logo_url: null,
    sort_order: i,
    status: "ACTIVE" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

export function getMockFounderRanks(founderId: string) {
  const founder = MOCK_FOUNDERS_DATA.find((f) => f.id === founderId);
  if (!founder) return null;

  const globalRank =
    MOCK_FOUNDERS_DATA.slice()
      .sort((a, b) => b.all_time_points - a.all_time_points)
      .findIndex((f) => f.id === founderId) + 1;

  const countryRank =
    MOCK_FOUNDERS_DATA.filter((f) => f.country_code === founder.country_code)
      .sort((a, b) => b.all_time_points - a.all_time_points)
      .findIndex((f) => f.id === founderId) + 1;

  return {
    founder_id: founderId,
    all_time_points: founder.all_time_points,
    today_points: founder.today_points,
    global_rank: globalRank,
    country_rank: countryRank,
  };
}
