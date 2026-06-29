import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Dr. Squeegee — Window Cleaning Charlotte NC"
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
          alignItems: "flex-start",
          background: "#0A0A0A",
          fontFamily: "system-ui, sans-serif",
          padding: "80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Teal accent bar — left edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "8px",
            height: "100%",
            background: "#2D8C6F",
          }}
        />

        {/* Subtle teal glow background */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,140,111,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Badge image — right side */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://drsqueegeeclt.com/images/squeegee/logo-badge.png"
          alt=""
          width={300}
          height={300}
          style={{
            position: "absolute",
            right: "80px",
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.95,
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div style={{ width: "40px", height: "3px", background: "#2D8C6F" }} />
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#2D8C6F",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Charlotte · Window Cleaning
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "80px",
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.0,
            letterSpacing: "-2px",
            marginBottom: "24px",
            maxWidth: "700px",
          }}
        >
          Streak-free windows,
        </div>
        <div
          style={{
            fontSize: "80px",
            fontWeight: 900,
            color: "#2D8C6F",
            lineHeight: 1.0,
            letterSpacing: "-2px",
            marginBottom: "48px",
          }}
        >
          every single time.
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#FFFFFF",
              background: "#2D8C6F",
              padding: "14px 36px",
              borderRadius: "10px",
            }}
          >
            Get a Free Quote
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#9CA3AF",
            }}
          >
            (980) 242-8048
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
