import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Dr. Squeegee — How did we do?"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The card that shows under the review text. The whole reason /review stopped
// being a 302: a redirect gives an unfurler nothing to render.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 50%, #1a3a2a 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#4ade80" }} />

        <div
          style={{
            fontSize: "68px",
            fontWeight: 800,
            color: "#FEFCF7",
            letterSpacing: "-1px",
            marginBottom: "14px",
          }}
        >
          Dr. Squeegee
        </div>

        <div style={{ fontSize: "40px", fontWeight: 700, color: "#4ade80", marginBottom: "30px" }}>
          How did we do?
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "32px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ fontSize: "44px", color: "#4ade80" }}>
              ★
            </div>
          ))}
        </div>

        <div style={{ fontSize: "25px", color: "#FEFCF7", opacity: 0.85, textAlign: "center" }}>
          Thirty seconds genuinely moves the needle for a small Charlotte crew
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6px", background: "#4ade80" }} />
      </div>
    ),
    { ...size }
  )
}
