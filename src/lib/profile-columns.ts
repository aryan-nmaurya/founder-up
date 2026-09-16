/**
 * The profile columns anon and authenticated may read - migration 0007 grants
 * exactly these. Selecting anything else, `*` included, is a permission error,
 * so every public profile read names this list.
 *
 * Free of server-only imports so the E2E suite can check it against the grant.
 */
export const PUBLIC_PROFILE_COLUMN_LIST = [
  "id",
  "username",
  "full_name",
  "avatar_url",
  "headline",
  "bio",
  "country_code",
  "website_url",
  "x_url",
  "linkedin_url",
  "github_url",
  "contact_type",
  "contact_value",
  "total_rank_points",
  "rank_reached_at",
  "founder_number",
  "is_early_founder",
  "is_ranked",
  "is_verified",
  "is_suspended",
  "created_at",
  "updated_at",
] as const;

export const PUBLIC_PROFILE_COLUMNS = PUBLIC_PROFILE_COLUMN_LIST.join(", ");

/** Readable only by the founder they belong to. */
export const PRIVATE_PROFILE_COLUMNS = [
  "auth_user_id",
  "is_admin",
  "country_changed_at",
  "profile_completed_at",
] as const;
