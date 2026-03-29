import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

export const metadata: Metadata = {
  title: "Charlotte House Washing & Pressure Washing Tips | Dr. Squeegee",
  description:
    "Expert tips on pressure washing, soft washing, and exterior home maintenance for Charlotte, NC homeowners. From Dr. Squeegee.",
  alternates: {
    canonical: "https://drsqueegeeclt.com/blog",
  },
  openGraph: {
    title: "Charlotte House Washing & Pressure Washing Tips | Dr. Squeegee",
    description:
      "Expert tips on pressure washing and exterior home maintenance for Charlotte homeowners.",
    url: "https://drsqueegeeclt.com/blog",
    siteName: "Dr. Squeegee",
    type: "website",
  },
}

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  published_at: string
}

async function getArticles(): Promise<Article[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from("seo_articles")
    .select("id, title, slug, excerpt, category, published_at")
    .eq("site", "drsqueegee")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("Error fetching articles:", error)
    return []
  }
  return data || []
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default async function SqueegeeBlotPage() {
  const articles = await getArticles()

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E1" }}>
      {/* Nav */}
      <nav style={{ backgroundColor: "#3A6B4C" }} className="sticky top-0 z-50 shadow-sm">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/get-quote" className="flex items-center gap-2">
            <span className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-brand-display)" }}>
              Dr. Squeegee
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/get-quote" className="text-sm text-green-100 hover:text-white transition-colors">
              Get a Quote
            </Link>
            <Link href="/blog" className="text-sm text-white font-medium underline underline-offset-4">
              Tips & Guides
            </Link>
          </div>
          <Link
            href="/get-quote"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#C8973E", color: "#fff" }}
          >
            Free Quote →
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-20 px-6" style={{ backgroundColor: "#2F5A3F" }}>
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium mb-6"
            style={{ borderColor: "#C8973E", color: "#C8973E", backgroundColor: "rgba(200,151,62,0.1)" }}>
            Tips & Guides
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white"
            style={{ fontFamily: "var(--font-brand-display)" }}>
            Pressure Washing Tips for{" "}
            <span style={{ color: "#C8973E" }}>Charlotte Homeowners</span>
          </h1>
          <p className="text-green-100 text-lg max-w-xl mx-auto">
            Expert advice on keeping your home&apos;s exterior clean, safe, and looking its best in the Carolinas.
          </p>
        </div>
      </div>

      {/* Articles */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        {articles.length === 0 ? (
          <p className="text-center" style={{ color: "#2B2B2B" }}>No articles yet. Check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="group flex flex-col rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
                style={{ backgroundColor: "#FEFCF7", border: "1px solid #C8D8CE" }}
              >
                {article.category && (
                  <span className="text-xs font-medium uppercase tracking-wider mb-3"
                    style={{ color: "#3A6B4C" }}>
                    {article.category}
                  </span>
                )}
                <h2 className="text-lg font-semibold leading-snug mb-3 flex-1"
                  style={{ color: "#2B2B2B", fontFamily: "var(--font-brand-display)" }}>
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: "#555" }}>
                    {article.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-4"
                  style={{ borderTop: "1px solid #C8D8CE" }}>
                  <time className="text-xs" style={{ color: "#888" }} dateTime={article.published_at}>
                    {formatDate(article.published_at)}
                  </time>
                  <span className="text-xs font-medium transition-colors" style={{ color: "#3A6B4C" }}>
                    Read more →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="py-16 px-6 text-center" style={{ backgroundColor: "#3A6B4C" }}>
        <h2 className="text-2xl font-bold text-white mb-3"
          style={{ fontFamily: "var(--font-brand-display)" }}>
          Ready for a cleaner home?
        </h2>
        <p className="text-green-100 mb-6">Charlotte&apos;s trusted pressure washing specialist. Fast quotes. Real results.</p>
        <Link
          href="/get-quote"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#C8973E" }}
        >
          Get a Free Quote →
        </Link>
      </div>
    </div>
  )
}
