"use client"

import { useEffect, useRef, useState } from "react"
import { BeeDecoration } from "./bee-decoration"

// Real Instagram post URLs — replace these as needed
// To switch to auto-updating: sign up at behold.so, connect @bumblebreadclub,
// get a feed ID, and swap this component for <BeholdWidget feedId="..." />
const FEATURED_POSTS = [
  "DVhPpvZAADf", // Reel (video)
  "DVeO5UUD3-J", // Post
  "DVkGq2biRUp", // Friends + sourdough + cocktails
  "DVytHRtjqC1", // Post
]

export function InstagramFeed() {
  const [loaded, setLoaded] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded) {
          setLoaded(true)
          if (!document.getElementById("instagram-embed-script")) {
            const script = document.createElement("script")
            script.id = "instagram-embed-script"
            script.src = "https://www.instagram.com/embed.js"
            script.async = true
            script.onload = () => {
              if (window.instgrm) window.instgrm.Embeds.process()
            }
            document.body.appendChild(script)
          } else if (window.instgrm) {
            window.instgrm.Embeds.process()
          }
        }
      },
      { rootMargin: "200px" }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [loaded])

  return (
    <section
      ref={sectionRef}
      className="relative px-6 py-20 md:py-28"
      style={{ backgroundColor: "var(--bb-cream-dark)" }}
    >
      {/* Decorative bee */}
      <div className="absolute top-8 right-8 md:right-20 opacity-50">
        <BeeDecoration className="w-7 h-7" />
      </div>

      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            @bumblebreadclub
          </h2>
          <p
            className="text-sm"
            style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
          >
            Follow along for batch drops, behind-the-scenes, and bread beauty shots
          </p>
        </div>

        {/* Embedded posts */}
        {loaded ? (
          <div className="space-y-6">
            {FEATURED_POSTS.map((shortcode) => (
              <div key={shortcode} className="flex justify-center">
                <blockquote
                  className="instagram-media"
                  data-instgrm-captioned
                  data-instgrm-permalink={`https://www.instagram.com/p/${shortcode}/`}
                  data-instgrm-version="14"
                  style={{
                    background: "var(--bb-cream)",
                    border: 0,
                    borderRadius: "16px",
                    margin: 0,
                    maxWidth: "540px",
                    minWidth: "280px",
                    width: "100%",
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {FEATURED_POSTS.map((_, i) => (
              <div
                key={i}
                className="rounded-2xl h-80 animate-pulse"
                style={{ backgroundColor: "var(--bb-cream)" }}
              />
            ))}
          </div>
        )}

        {/* Follow CTA */}
        <div className="text-center mt-12">
          <a
            href="https://instagram.com/bumblebreadclub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              fontFamily: "var(--font-bb-body)",
              backgroundColor: "var(--bb-navy)",
              color: "var(--bb-cream)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Follow @bumblebreadclub
          </a>
        </div>
      </div>
    </section>
  )
}
