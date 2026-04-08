import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

interface ArticleRow {
  slug: string
  published_at: string
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: "https://www.drsqueegeeclt.com/get-quote", lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: "https://www.drsqueegeeclt.com/about", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://www.drsqueegeeclt.com/blog", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: "https://www.drsqueegeeclt.com/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://www.drsqueegeeclt.com/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://www.drsqueegeeclt.com/llms.txt", lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ]

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: articles } = await supabase
      .from("seo_articles")
      .select("slug, published_at")
      .eq("site", "drsqueegee")
      .order("published_at", { ascending: false })

    const articleUrls: MetadataRoute.Sitemap = (articles as ArticleRow[] || []).map((article) => ({
      url: `https://www.drsqueegeeclt.com/blog/${article.slug}`,
      lastModified: new Date(article.published_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))

    return [...staticUrls, ...articleUrls]
  } catch (err) {
    console.error("Sitemap: failed to fetch articles", err)
    return staticUrls
  }
}
