import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

interface Article {
  id: string
  title: string
  slug: string
  meta_description: string | null
  content: string
  excerpt: string | null
  category: string | null
  tags: string[] | null
  published_at: string
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getArticle(slug: string): Promise<Article | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("seo_articles")
    .select("*")
    .eq("site", "drsqueegee")
    .eq("slug", slug)
    .single()

  if (error || !data) return null
  return data
}

async function getRelatedArticles(category: string | null, currentSlug: string): Promise<Article[]> {
  const supabase = getSupabase()
  let query = supabase
    .from("seo_articles")
    .select("id, title, slug, excerpt, category, published_at")
    .eq("site", "drsqueegee")
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3)

  if (category) {
    query = query.eq("category", category)
  }

  const { data } = await query
  return (data as Article[]) || []
}

export async function generateStaticParams() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("seo_articles")
    .select("slug")
    .eq("site", "drsqueegee")

  return (data || []).map((row: { slug: string }) => ({ slug: row.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}

  return {
    title: `${article.title} | Dr. Squeegee`,
    description: article.meta_description || article.excerpt || "",
    alternates: {
      canonical: `https://drsqueegeeclt.com/blog/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.meta_description || article.excerpt || "",
      url: `https://drsqueegeeclt.com/blog/${article.slug}`,
      siteName: "Dr. Squeegee",
      type: "article",
      publishedTime: article.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.meta_description || article.excerpt || "",
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function renderContent(content: string) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-2xl font-bold mt-10 mb-4" style={{ color: "#2B2B2B", fontFamily: "var(--font-brand-display)" }}>
          {line.replace("## ", "")}
        </h2>
      )
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-xl font-semibold mt-8 mb-3" style={{ color: "#2B2B2B" }}>
          {line.replace("### ", "")}
        </h3>
      )
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const listItems: string[] = []
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        listItems.push(lines[i].replace(/^[-*] /, ""))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-2 my-4 ml-2" style={{ color: "#444" }}>
          {listItems.map((item, j) => (
            <li key={j} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      )
      continue
    } else if (line.trim() !== "") {
      elements.push(
        <p key={i} className="leading-relaxed my-4" style={{ color: "#444" }}>
          {line}
        </p>
      )
    }
    i++
  }

  return elements
}

export default async function SqueegeeArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  const related = await getRelatedArticles(article.category, slug)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description || article.excerpt,
    datePublished: article.published_at,
    dateModified: article.published_at,
    author: {
      "@type": "Organization",
      name: "Dr. Squeegee",
      url: "https://drsqueegeeclt.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Dr. Squeegee",
      url: "https://drsqueegeeclt.com",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://drsqueegeeclt.com/blog/${article.slug}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#C8973E" }}
            >
              Free Quote →
            </Link>
          </div>
        </nav>

        {/* Article */}
        <article className="mx-auto max-w-3xl px-6 py-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: "#888" }}>
            <Link href="/get-quote" className="hover:underline" style={{ color: "#3A6B4C" }}>Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:underline" style={{ color: "#3A6B4C" }}>Tips & Guides</Link>
            {article.category && (
              <>
                <span>/</span>
                <span style={{ color: "#C8973E" }}>{article.category}</span>
              </>
            )}
          </nav>

          {/* Header */}
          {article.category && (
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#3A6B4C" }}>
              {article.category}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-4 leading-tight"
            style={{ color: "#2B2B2B", fontFamily: "var(--font-brand-display)" }}>
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm mb-2 pb-8" style={{ color: "#888", borderBottom: "1px solid #C8D8CE" }}>
            <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
            <span>·</span>
            <span>Dr. Squeegee</span>
          </div>

          {/* Content */}
          <div className="mt-8">
            {renderContent(article.content)}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-12 pt-8 flex flex-wrap gap-2" style={{ borderTop: "1px solid #C8D8CE" }}>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs rounded-full px-3 py-1"
                  style={{ border: "1px solid #C8D8CE", color: "#555", backgroundColor: "#fff" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* CTA Banner */}
        <div className="py-12 px-6 text-center" style={{ backgroundColor: "#3A6B4C" }}>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-brand-display)" }}>
            Ready to schedule your wash?
          </h2>
          <p className="text-green-100 mb-6 max-w-md mx-auto">
            Charlotte&apos;s trusted pressure washing specialist. Get a free quote in 60 seconds.
          </p>
          <Link
            href="/get-quote"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#C8973E" }}
          >
            Get a Free Quote →
          </Link>
        </div>

        {/* Related Articles */}
        {related.length > 0 && (
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-bold mb-8" style={{ color: "#2B2B2B", fontFamily: "var(--font-brand-display)" }}>
              More Tips & Guides
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/blog/${rel.slug}`}
                  className="group flex flex-col rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
                  style={{ backgroundColor: "#FEFCF7", border: "1px solid #C8D8CE" }}
                >
                  {rel.category && (
                    <span className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "#3A6B4C" }}>
                      {rel.category}
                    </span>
                  )}
                  <h3 className="text-base font-semibold leading-snug" style={{ color: "#2B2B2B", fontFamily: "var(--font-brand-display)" }}>
                    {rel.title}
                  </h3>
                  <span className="mt-3 text-xs font-medium" style={{ color: "#3A6B4C" }}>
                    Read more →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export const revalidate = 3600 // ISR: revalidate every hour
