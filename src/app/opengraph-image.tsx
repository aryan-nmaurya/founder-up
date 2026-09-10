import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;

/** Plan §41 - clean white, no artwork. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#6b6b6b", letterSpacing: 1 }}>
          {APP_NAME.toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 76,
            fontWeight: 700,
            color: "#111111",
            letterSpacing: -2,
          }}
        >
          {APP_TAGLINE}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: "#6b6b6b" }}>
          Discover who&apos;s building what.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: 22,
            color: "#8f8f8f",
          }}
        >
          Rankings are determined by paid Rank Points.
        </div>
      </div>
    ),
    size,
  );
}
