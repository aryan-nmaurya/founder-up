import { ImageResponse } from "next/og";
import { getProfileByUsername, getVentures } from "@/lib/db";
import { getFounderRanks } from "@/lib/ranking";
import { countryName } from "@/lib/countries";
import { APP_NAME } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Founder profile";

/**
 * Plan §41 - the share card. Clean white, no artwork, rank front and centre.
 * Emoji flags are avoided here because ImageResponse would need an emoji font.
 */
export default async function FounderOpenGraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            fontSize: 48,
            color: "#111111",
            fontFamily: "sans-serif",
          }}
        >
          {APP_NAME}
        </div>
      ),
      size,
    );
  }

  const [ranks, ventures] = await Promise.all([
    getFounderRanks(profile.id),
    getVentures(profile.id),
  ]);

  const country = countryName(profile.country_code);
  const venture = ventures[0]?.name ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, color: "#6b6b6b", letterSpacing: 1 }}>
          {APP_NAME.toUpperCase()}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 68,
            fontWeight: 700,
            color: "#111111",
            letterSpacing: -2,
          }}
        >
          {profile.full_name.toUpperCase()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, gap: 8 }}>
          {ranks?.country_rank ? (
            <div style={{ display: "flex", fontSize: 38, color: "#111111" }}>
              #{ranks.country_rank} Founder in {country}
            </div>
          ) : null}
          {ranks?.global_rank ? (
            <div style={{ display: "flex", fontSize: 38, color: "#6b6b6b" }}>
              #{ranks.global_rank} Global
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 34, color: "#6b6b6b" }}>
              Founder in {country}
            </div>
          )}
        </div>

        {venture ? (
          <div style={{ display: "flex", marginTop: 30, fontSize: 32, color: "#111111" }}>
            Building {venture}
          </div>
        ) : profile.headline ? (
          <div style={{ display: "flex", marginTop: 30, fontSize: 30, color: "#111111" }}>
            {profile.headline}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: 22,
            color: "#8f8f8f",
          }}
        >
          founderup.com/{profile.username}
        </div>
      </div>
    ),
    size,
  );
}
