"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

type Tier = "desktop" | "mobile"

function pickTier(): Tier {
  if (typeof window === "undefined") return "desktop"
  const small = window.matchMedia("(max-width: 768px)").matches
  const pointer = window.matchMedia("(pointer: coarse)").matches
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  const slow = conn?.effectiveType === "2g" || conn?.saveData === true
  return small || pointer || slow ? "mobile" : "desktop"
}

function frameUrl(slug: string, tier: Tier, index: number): string {
  const n = String(index).padStart(3, "0")
  return `/scroll-sequences/${slug}/${tier}/frame-${n}.webp`
}

/** object-fit: cover math for canvas drawImage */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cssW: number,
  cssH: number,
): void {
  const scale = Math.max(cssW / img.width, cssH / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (cssW - dw) / 2
  const dy = (cssH - dh) / 2
  ctx.clearRect(0, 0, cssW, cssH)
  ctx.drawImage(img, dx, dy, dw, dh)
}

/**
 * Apple-style scroll-driven image sequence.
 *
 * The sequence is the subject — no overlay content. Headline/CTA lives in
 * sibling sections above/below. An optional `eyebrow` renders as a small
 * top-center label (very quiet type, does not fight the photography).
 *
 * Architecture:
 * - Fire all frames as native <Image>.src at once; let the browser pipeline
 *   handle queuing (6 per origin on HTTP/2, more with multiplexing).
 * - ScrollTrigger activates immediately on mount. draw() reads frames[i].
 *   complete — if the target frame isn't loaded yet, it holds the last
 *   complete frame. Scrolling past the buffer feels tacky early on and
 *   crisp once frames fill in. Never blocks.
 * - Poster <img> sits under the canvas at fetchPriority="high" so LCP
 *   measures against the static first-frame, not an empty canvas.
 * - Reduced-motion: skip the pin, draw the last (clean) frame static.
 */
export function ScrollSequenceHero({
  sequenceSlug,
  desktopFrames = 120,
  mobileFrames = 60,
  poster,
  scrubDuration = "200%",
  eyebrow,
}: {
  sequenceSlug: string
  desktopFrames?: number
  mobileFrames?: number
  poster?: string
  scrubDuration?: string
  eyebrow?: React.ReactNode
}) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const posterSrc = poster ?? `/scroll-sequences/${sequenceSlug}/poster.webp`

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const tier = pickTier()
    const total = tier === "desktop" ? desktopFrames : mobileFrames

    // Fire all frame loads at once — browser handles the queue.
    const frames: HTMLImageElement[] = []
    for (let i = 0; i < total; i++) {
      const img = new Image()
      img.src = frameUrl(sequenceSlug, tier, i + 1)
      frames.push(img)
    }

    let cssW = 0
    let cssH = 0
    let lastComplete = 0

    const measure = () => {
      const rect = section.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cssW = rect.width
      cssH = rect.height
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = cssW + "px"
      canvas.style.height = cssH + "px"
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(targetIdx, total - 1))
      let i = clamped
      // Walk backward to find the nearest loaded frame — feels like the
      // video is slightly behind the scroll at first, snaps forward once
      // frames decode. Beats drawing nothing.
      while (i > 0 && !frames[i].complete) i--
      if (frames[i].complete && frames[i].naturalWidth > 0) {
        lastComplete = i
        drawCover(ctx, frames[i], cssW, cssH)
      } else if (lastComplete > 0) {
        drawCover(ctx, frames[lastComplete], cssW, cssH)
      }
    }

    measure()

    // If prefers-reduced-motion, bail early: render the last clean frame.
    if (reduced) {
      const last = frames[total - 1]
      if (last.complete) {
        drawCover(ctx, last, cssW, cssH)
      } else {
        last.addEventListener(
          "load",
          () => drawCover(ctx, last, cssW, cssH),
          { once: true },
        )
      }
      const onResize = () => measure()
      window.addEventListener("resize", onResize)
      return () => window.removeEventListener("resize", onResize)
    }

    // Draw whatever we have as frames arrive — progressively sharpens the
    // initial scroll experience.
    frames.forEach((img, i) => {
      img.addEventListener(
        "load",
        () => {
          if (i === 0 && lastComplete === 0) {
            drawCover(ctx, img, cssW, cssH)
            lastComplete = i
          }
        },
        { once: true },
      )
    })

    const gsapCtx = gsap.context(() => {
      const playhead = { frame: 0 }
      gsap.to(playhead, {
        frame: total - 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: `+=${scrubDuration}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
        onUpdate: () => draw(Math.round(playhead.frame)),
      })
    }, sectionRef)

    const onResize = () => {
      measure()
      draw(lastComplete)
      ScrollTrigger.refresh()
    }
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      gsapCtx.revert()
      frames.length = 0
    }
  }, [sequenceSlug, desktopFrames, mobileFrames, scrubDuration])

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-[#FEFCF7]"
      aria-label="Before-and-after pressure-wash transformation"
    >
      {/* LCP-eligible poster under the canvas — prevents LCP regression vs
          an empty canvas and acts as the static fallback. */}
      <img
        src={posterSrc}
        alt="Charlotte colonial home before pressure washing"
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
        decoding="async"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {eyebrow && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
          <p className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/90 drop-shadow-md font-medium">
            {eyebrow}
          </p>
        </div>
      )}
    </section>
  )
}
