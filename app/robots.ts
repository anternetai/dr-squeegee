import type { MetadataRoute } from "next"

// Customer surfaces (/q/ quotes, /r/ receipts) must stay OUT of search results —
// they carry real names, addresses and prices — but they must stay reachable by
// the link-preview fetchers, or a texted quote arrives as a bare grey URL with
// no Dr. Squeegee card on it.
//
// Search indexing is blocked two ways regardless of what is allowed here: those
// pages also emit <meta name="robots" content="noindex, nofollow">, and the
// tokens are unguessable and unlinked from anywhere crawlable.
const PREVIEW_BOTS = [
  "Applebot",           // iMessage / Safari link previews
  "facebookexternalhit", // Facebook + Messenger
  "Twitterbot",
  "Slackbot-LinkExpanding",
  "TelegramBot",
  "WhatsApp",
  "LinkedInBot",
  "Discordbot",
  "SkypeUriPreview",
  "redditbot",
  "Iframely",
  "vkShare",
]

export default function robots(): MetadataRoute.Robots {
  // /review is a real public page now (branded review + private-feedback doors),
  // not the old redirect — it carries no customer data, so it is fully public.
  const publicPaths = ["/get-quote", "/about", "/blog", "/privacy", "/terms", "/bumblebread", "/llms.txt", "/review"]

  // Token-gated customer pages. Allowed for preview bots only.
  const customerPaths = ["/q/", "/r/"]

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicPaths,
        disallow: ["/crm/", "/q/", "/r/", "/api/"],
      },
      // Explicitly welcome AI search crawlers
      {
        userAgent: ["GPTBot", "ChatGPT-User", "Claude-Web", "PerplexityBot", "Applebot-Extended"],
        allow: [...publicPaths, "/*.md"],
        disallow: ["/crm/", "/q/", "/r/", "/api/"],
      },
      // Link-unfurlers: allowed to fetch a quote/receipt so the preview card
      // renders. These agents generate previews, they do not populate a search
      // index. Note Applebot-Extended (AI training) stays disallowed above —
      // it is a different agent from Applebot (previews/Siri).
      {
        userAgent: PREVIEW_BOTS,
        allow: [...publicPaths, ...customerPaths],
        disallow: ["/crm/", "/api/"],
      },
    ],
    sitemap: "https://www.drsqueegeeclt.com/sitemap.xml",
  }
}
