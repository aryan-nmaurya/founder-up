export type ContactType = "WEBSITE" | "X" | "LINKEDIN" | "EMAIL";
export type VentureType = "PROJECT" | "BUSINESS";
export type LinkType =
  | "WEBSITE"
  | "X"
  | "LINKEDIN"
  | "GITHUB"
  | "EMAIL"
  | "CONNECT"
  | "VENTURE";
export type LedgerType = "PAYMENT" | "REFUND" | "CHARGEBACK" | "ADMIN_ADJUSTMENT";
export type BoostOrderStatus =
  | "CREATED"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED";
export type PaymentStatus = "CAPTURED" | "REFUNDED" | "DISPUTED";
export type ReportReason =
  | "IMPERSONATION"
  | "SPAM"
  | "SCAM"
  | "ILLEGAL"
  | "EXPLICIT"
  | "HATE"
  | "MISLEADING_LINK"
  | "OTHER";
export type ReportStatus = "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED";
export type ActivityType =
  | "JOINED"
  | "BOOSTED"
  | "RANK_UP"
  | "ENTERED_TOP_10"
  | "REACHED_NUMBER_ONE";

export type Profile = {
  id: string;
  auth_user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  country_code: string;
  country_changed_at: string | null;
  website_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  contact_type: ContactType;
  contact_value: string | null;
  total_rank_points: number;
  rank_reached_at: string;
  is_verified: boolean;
  is_suspended: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Venture = {
  id: string;
  founder_id: string;
  type: VentureType;
  name: string;
  description: string | null;
  url: string | null;
  logo_url: string | null;
  status: "ACTIVE" | "HIDDEN";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LeaderboardRow = {
  rank: number;
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  country_code: string;
  points: number;
  is_verified: boolean;
  venture_name: string | null;
  venture_url: string | null;
};

export type SearchRow = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  country_code: string;
  points: number;
  is_verified: boolean;
  venture_name: string | null;
};

export type FounderRanks = {
  global_rank: number | null;
  country_rank: number | null;
  today_global_rank: number | null;
  today_country_rank: number | null;
  total_points: number;
  today_points: number;
  country_code: string;
};

export type NextRankGap = {
  global_gap: number | null;
  global_target_rank: number | null;
  country_gap: number | null;
  country_target_rank: number | null;
};

export type FounderStats = {
  profile_views: number;
  website_clicks: number;
  connect_clicks: number;
};

export type BoostOrder = {
  id: string;
  founder_id: string;
  requested_amount: number;
  requested_currency: "INR" | "USD";
  razorpay_order_id: string | null;
  status: BoostOrderStatus;
  created_at: string;
  completed_at: string | null;
};

export type Payment = {
  id: string;
  boost_order_id: string | null;
  founder_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  currency: string;
  amount_subunit: number;
  base_currency: string;
  base_amount_subunit: number;
  rank_points_awarded: number;
  status: PaymentStatus;
  captured_at: string | null;
  created_at: string;
};

export type RankLedgerEntry = {
  id: string;
  founder_id: string;
  points: number;
  type: LedgerType;
  payment_id: string | null;
  reason: string | null;
  created_at: string;
};

export type ActivityEvent = {
  id: number;
  founder_id: string;
  type: ActivityType;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: Pick<Profile, "username" | "full_name" | "country_code"> | null;
};

export type Report = {
  id: string;
  reporter_id: string | null;
  profile_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
};

export type WebhookEvent = {
  id: string;
  provider: string;
  event_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";
  error: string | null;
  attempts: number;
  created_at: string;
  processed_at: string | null;
};

export type AwardResult = {
  status:
    | "AWARDED"
    | "ALREADY_PROCESSED"
    | "UNKNOWN_ORDER"
    | "UNKNOWN_FOUNDER";
  payment_id?: string;
  founder_id?: string;
  username?: string;
  rank_points?: number;
  total_rank_points?: number;
  previous_global_rank: number | null;
  new_global_rank: number | null;
  previous_country_rank: number | null;
  new_country_rank: number | null;
  country_code?: string;
};
