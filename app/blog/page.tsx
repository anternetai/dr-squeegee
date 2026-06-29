import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

export const metadata: Metadata = {
  title: "Window Cleaning Tips for Charlotte Homeowners | Dr. Squeegee",
  description: "Expert tips on window cleaning, house washing, and exterior home maintenance for Charlotte, NC homeowners. From Dr. Squeegee.",
  alternates: { canonical: "https://www.drsqueegeeclt.com/blog" },
  openGraph: {
    title: "Window Cleaning Tips for Charlotte Homeowners | Dr. Squeegee",
    description: "Expert tips on window cleaning and exterior home maintenance for Charlotte homeowners.",
    url: "https://www.drsqueegeeclt.com/blog",
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
  if (error) console.error("Error fetching articles:", error)
  return data || []
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function Logo() {
  return <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-14 w-auto" />
}

export default async function SqueegeeBlotPage() {
  const articles = await getArticles()

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#242424] bg-[#0A0A0A]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 flex items-center justify-between h-16">
          <Link href="/get-quote"><Logo /></Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/get-quote" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">
              Get a Quote
            </Link>
            <Link href="/blog" className="text-sm text-white font-medium underline underline-offset-4">
              Tips & Guides
            </Link>
          </div>
          <Link
            href="/get-quote"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#2D8C6F] hover:bg-[#1F6B54] transition-colors"
          >
            Free Quote →
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-20 px-5 border-b border-[#242424]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2D8C6F] mb-4">Tips & Guides</p>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white"
            style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
          >
            Window Cleaning Tips for{" "}
            <span className="text-[#2D8C6F]">Charlotte Homeowners</span>
          </h1>
          <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
            Expert advice on keeping your home&apos;s exterior clean, safe, and looking its best in the Carolinas.
          </p>
        </div>
      </div>

      {/* Articles */}
      <div className="mx-auto max-w-6xl px-5 py-16">
        {articles.length === 0 ? (
          <p className="text-center text-[#9CA3AF]">No articles yet. Check back soon.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="group flex flex-col rounded-xl p-6 bg-[#111111] border border-[#242424] hover:border-[#2D8C6F]/40 hover:bg-[#141414] transition-all duration-200"
              >
                {article.category && (
                  <span className="text-xs font-semibold uppercase tracking-wider mb-3 text-[#2D8C6F]">
                    {article.category}
                  </span>
                )}
                <h2
                  className="text-lg font-semibold leading-snug mb-3 flex-1 text-white group-hover:text-[#2D8C6F] transition-colors"
                  style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
                >
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-sm leading-relaxed mb-4 line-clamp-3 text-[#9CA3AF]">
                    {article.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#242424]">
                  <time className="text-xs text-[#9CA3AF]/60" dateTime={article.published_at}>
                    {formatDate(article.published_at)}
                  </time>
                  <span className="text-xs font-medium text-[#2D8C6F]">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="py-16 px-5 text-center border-t border-[#242424]">
        <h2
          className="text-2xl font-bold text-white mb-3"
          style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
        >
          Ready for a cleaner home?
        </h2>
        <p className="text-[#9CA3AF] mb-6">Charlotte&apos;s trusted window cleaning specialist. Fast quotes. Real results.</p>
        <Link
          href="/get-quote"
          className="inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold text-white bg-[#2D8C6F] hover:bg-[#1F6B54] transition-colors"
        >
          Get a Free Quote →
        </Link>
      </div>
    </div>
  )
}
