import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const publicPaths = ["/get-quote", "/about", "/blog", "/privacy", "/terms", "/bumblebread", "/llms.txt"]

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicPaths,
        disallow: ["/crm/", "/q/", "/api/"],
      },
      // Explicitly welcome AI search crawlers
      {
        userAgent: ["GPTBot", "ChatGPT-User", "Claude-Web", "PerplexityBot", "Applebot-Extended"],
        allow: [...publicPaths, "/*.md"],
        disallow: ["/crm/", "/q/", "/api/"],
      },
    ],
    sitemap: "https://www.drsqueegeeclt.com/sitemap.xml",
  }
}
