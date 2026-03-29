import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Dr. Squeegee — Pressure Washing Charlotte NC"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

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
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "#4ade80",
          }}
        />

        {/* Brand name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "#FEFCF7",
            letterSpacing: "-1px",
            marginBottom: "16px",
          }}
        >
          Dr. Squeegee
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: "#4ade80",
            marginBottom: "40px",
          }}
        >
          Charlotte&apos;s Trusted Pressure Washing Pros
        </div>

        {/* Divider */}
        <div
          style={{
            width: "120px",
            height: "3px",
            background: "#FEFCF7",
            opacity: 0.4,
            marginBottom: "40px",
          }}
        />

        {/* Services */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginBottom: "40px",
          }}
        >
          {["House Washing", "Driveways", "Patios & Decks"].map((svc) => (
            <div
              key={svc}
              style={{
                fontSize: "22px",
                color: "#FEFCF7",
                opacity: 0.85,
                padding: "8px 24px",
                border: "1px solid rgba(254,252,247,0.3)",
                borderRadius: "8px",
              }}
            >
              {svc}
            </div>
          ))}
        </div>

        {/* CTA + phone */}
        <div
          style={{
            fontSize: "26px",
            fontWeight: 700,
            color: "#1a3a2a",
            background: "#4ade80",
            padding: "12px 40px",
            borderRadius: "12px",
          }}
        >
          Get Your Free Quote — (980) 242-8048
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "#4ade80",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
