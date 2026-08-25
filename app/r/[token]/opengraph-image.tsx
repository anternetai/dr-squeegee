import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Dr. Squeegee — Payment Receipt"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The card a customer sees in their messages before they even tap. Deliberately
// says PAID and nothing about the amount — a preview renders on a lock screen.
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
            fontSize: "72px",
            fontWeight: 800,
            color: "#FEFCF7",
            letterSpacing: "-1px",
            marginBottom: "16px",
          }}
        >
          Dr. Squeegee
        </div>

        <div style={{ fontSize: "36px", fontWeight: 600, color: "#4ade80", marginBottom: "32px" }}>
          Payment Receipt
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            background: "rgba(74, 222, 128, 0.15)",
            border: "2px solid #4ade80",
            borderRadius: "999px",
            padding: "12px 34px",
            marginBottom: "36px",
          }}
        >
          <div style={{ fontSize: "30px", color: "#4ade80" }}>✓</div>
          <div style={{ fontSize: "30px", fontWeight: 700, color: "#4ade80", letterSpacing: "2px" }}>PAID</div>
        </div>

        <div style={{ fontSize: "26px", color: "#FEFCF7", opacity: 0.85 }}>
          House Calls for a Cleaner Home
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6px", background: "#4ade80" }} />
      </div>
    ),
    { ...size }
  )
}
