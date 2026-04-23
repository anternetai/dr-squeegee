"use client"

import { useEffect, useRef, useState } from "react"
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

/**
 * Bounded-concurrency preloader. img.decode() runs off-main-thread and resolves
 * only when the bitmap is ready to paint — avoids first-drawImage jank.
 */
async function preloadSequence(
  urls: string[],
  concurrency: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<HTMLImageElement[]> {
  const images: HTMLImageElement[] = new Array(urls.length)
  let cursor = 0
  let done = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < urls.length) {
      const i = cursor++
      const img = new Image()
      img.src = urls[i]
      try {
        await img.decode()
      } catch {
        // fall through; image may still draw via implicit decode
      }
      images[i] = img
      done++
      onProgress?.(done, urls.length)
    }
  })
  await Promise.all(workers)
  return images
}

/** object-fit: cover equivalent for canvas drawImage */
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
 * Apple-style scroll-driven image sequence hero.
 *
 * Pins a full-viewport canvas and maps scroll progress to frame index —
 * preloaded WebP frames drawn via `ctx.drawImage`, not video scrubbing.
 * Mobile ships a reduced-count, reduced-resolution frame set.
 *
 * Failure modes handled: preload >3s (falls back to static poster, no pin),
 * prefers-reduced-motion (static last frame, no pin), SSR (all setup in effect),
 * connection 2g/saveData (forced to mobile tier).
 */
export function ScrollSequenceHero({
  sequenceSlug,
  desktopFrames = 120,
  mobileFrames = 60,
  poster,
  overlay = "bg-black/40",
  scrubDuration = "150%",
  loaderColor = "#3A6B4C",
  children,
}: {
  sequenceSlug: string
  desktopFrames?: number
  mobileFrames?: number
  poster?: string
  overlay?: string
  scrubDuration?: string
  loaderColor?: string
  children: React.ReactNode
}) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [staticFallback, setStaticFallback] = useState(false)

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
    const urls = Array.from({ length: total }, (_, i) => frameUrl(sequenceSlug, tier, i + 1))

    let frames: HTMLImageElement[] = []
    let lastDrawn = -1
    let cancelled = false
    let timeoutHandle: number | undefined

    const measure = () => {
      const rect = section.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = rect.width
      const cssH = rect.height
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = cssW + "px"
      canvas.style.height = cssH + "px"
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { cssW, cssH }
    }

    const draw = (i: number) => {
      const clamped = Math.max(0, Math.min(i, frames.length - 1))
      if (clamped === lastDrawn) return
      const img = frames[clamped]
      if (!img) return
      lastDrawn = clamped
      const { cssW, cssH } = measureCached
      drawCover(ctx, img, cssW, cssH)
    }

    let measureCached = measure()
    const lastSeenFrame = { current: 0 }

    const onResize = () => {
      measureCached = measure()
      lastDrawn = -1
      if (frames.length > 0) draw(lastSeenFrame.current)
      ScrollTrigger.refresh()
    }

    const gsapCtx = gsap.context(() => {
      // reduced-motion path: render last frame static, no pin
      if (reduced) {
        ;(async () => {
          const img = new Image()
          img.src = urls[urls.length - 1]
          try { await img.decode() } catch {}
          if (cancelled) return
          frames = [img]
          measureCached = measure()
          drawCover(ctx, img, measureCached.cssW, measureCached.cssH)
          setReady(true)
        })()
        return
      }

      // main path: preload with 3s timeout, then activate ScrollTrigger
      const preloadPromise = preloadSequence(urls, 6, (loaded, t) => {
        if (cancelled) return
        setProgress(loaded / t)
      })

      const timeout = new Promise<"timeout">((resolve) => {
        timeoutHandle = window.setTimeout(() => resolve("timeout"), 3000)
      })

      ;(async () => {
        const raced = await Promise.race([preloadPromise, timeout])
        if (cancelled) return

        if (raced === "timeout") {
          // network too slow — show poster, skip pin/scrub
          setStaticFallback(true)
          setReady(true)
          return
        }

        frames = raced as HTMLImageElement[]
        measureCached = measure()
        draw(0)
        setReady(true)

        const playhead = { frame: 0 }
        gsap.to(playhead, {
          frame: frames.length - 1,
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
          onUpdate: () => {
            const i = Math.round(playhead.frame)
            lastSeenFrame.current = i
            draw(i)
          },
        })
      })()
    }, sectionRef)

    window.addEventListener("resize", onResize)

    return () => {
      cancelled = true
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle)
      window.removeEventListener("resize", onResize)
      gsapCtx.revert()
      frames = []
    }
  }, [sequenceSlug, desktopFrames, mobileFrames, scrubDuration])

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-black"
      aria-label="Before-and-after pressure-wash transformation"
    >
      {/* LCP-eligible poster under the canvas — becomes the static fallback
          and prevents LCP regression vs an empty canvas */}
      <img
        src={posterSrc}
        alt="Charlotte colonial home before pressure washing"
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
        decoding="async"
        aria-hidden={ready && !staticFallback}
      />

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
          ready && !staticFallback ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Branded preload progress bar — Squeegee Green, tasteful */}
      {!ready && !staticFallback && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center p-8">
          <div className="h-0.5 w-32 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: loaderColor }}
            />
          </div>
        </div>
      )}

      <div className={`absolute inset-0 ${overlay} z-10`} />

      <div className="relative z-20 flex h-full items-center justify-center">
        {children}
      </div>
    </section>
  )
}
