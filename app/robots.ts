import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/get-quote", "/about", "/blog", "/privacy", "/terms", "/bumblebread"],
        disallow: ["/crm/", "/q/", "/api/"],
      },
    ],
    sitemap: "https://www.drsqueegeeclt.com/sitemap.xml",
  }
}
