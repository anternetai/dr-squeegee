import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { CONTENT_MAP } from "@/lib/llms/content"

const MD_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key)
}

/** Format a date string safely, returning a fallback for invalid values. */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Recently published"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "Recently published"
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path") || "/"

  // Sanitize: only allow paths that look like URL paths (letters, numbers, hyphens, slashes)
  if (!/^\/[\w\-\/]*$/.test(rawPath)) {
    return new NextResponse(
      "# 400 — Bad Request\n\nInvalid path.\n",
      { status: 400, headers: MD_HEADERS }
    )
  }
  const path = rawPath

  // 1. Static content map
  if (CONTENT_MAP[path]) {
    return new NextResponse(CONTENT_MAP[path].markdown, { headers: MD_HEADERS })
  }

  // 2. Blog index
  if (path === "/blog") {
    try {
      const { data: articles } = await supabase()
        .from("seo_articles")
        .select("title, slug, excerpt, published_at")
        .eq("site", "drsqueegee")
        .order("published_at", { ascending: false })

      let md = `# Dr. Squeegee Blog\n\n> Pressure washing tips, guides, and insights for Charlotte homeowners.\n\n`

      if (articles && articles.length > 0) {
        for (const a of articles) {
          md += `## [${a.title}](https://drsqueegeeclt.com/blog/${a.slug}.md)\n\n`
          md += `*${formatDate(a.published_at)}*\n\n`
          if (a.excerpt) md += `${a.excerpt}\n\n`
          md += `---\n\n`
        }
      } else {
        md += `*No articles published yet. Check back soon!*\n`
      }

      return new NextResponse(md, { headers: MD_HEADERS })
    } catch {
      return new NextResponse("# Blog\n\n*Unable to load articles.*\n", {
        status: 500,
        headers: MD_HEADERS,
      })
    }
  }

  // 3. Individual blog post
  if (path.startsWith("/blog/")) {
    const slug = path.replace("/blog/", "")
    if (slug && /^[\w\-]+$/.test(slug)) {
      try {
        const { data: article } = await supabase()
          .from("seo_articles")
          .select("title, content, excerpt, meta_description, published_at, category, tags")
          .eq("site", "drsqueegee")
          .eq("slug", slug)
          .single()

        if (article) {
          let md = `# ${article.title}\n\n`
          md += `*Published ${formatDate(article.published_at)}*`
          if (article.category) md += ` | *${article.category}*`
          md += `\n\n`
          if (article.meta_description) md += `> ${article.meta_description}\n\n`
          md += `${article.content}\n`

          return new NextResponse(md, { headers: MD_HEADERS })
        }
      } catch {
        // fall through to 404
      }
    }
  }

  // 4. Not found
  return new NextResponse(
    "# 404 — Page Not Found\n\nThis page does not have a markdown version.\n\nSee [/llms.txt](https://drsqueegeeclt.com/llms.txt) for available pages.\n",
    { status: 404, headers: MD_HEADERS }
  )
}
