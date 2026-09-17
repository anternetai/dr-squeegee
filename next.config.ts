import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // The crew portal's before/after camera is getUserMedia, which the blanket
      // `camera=()` above forbids outright — Chrome rejects the call before a
      // permission prompt ever appears, so the CameraSheet would silently fall
      // back to the OS file picker on every phone. This re-grants the camera to
      // this origin only, and only under /team; /crm, /portal and the marketing
      // site stay locked.
      //
      // These entries MUST stay AFTER the catch-all: when two rules match the
      // same path and carry the same header key, the LAST one wins. Verified by
      // serving a production build both ways with a marker header.
      {
        source: "/team",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/team/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
