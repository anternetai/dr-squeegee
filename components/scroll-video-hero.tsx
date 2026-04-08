"use client"

import { useRef, useEffect, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/** Detect touch-primary devices where scroll-pinning is unreliable */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    // coarse pointer = touch device (phones/tablets)
    const mq = window.matchMedia("(pointer: coarse)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isMobile
}

/**
 * Scroll-synced video background.
 *
 * **Desktop**: Pins a full-screen video and scrubs video.currentTime as the
 * user scrolls through the trigger zone (GSAP ScrollTrigger).
 *
 * **Mobile**: Falls back to a simple muted autoplay loop — scroll-pinning
 * and video.currentTime scrubbing are unreliable on iOS/Android browsers.
 */
export function ScrollVideoHero({
  src,
  poster,
  children,
  scrubDuration = "200%",
  overlay = "bg-black/40",
}: {
  src: string
  poster?: string
  children: React.ReactNode
  /** How tall the scroll-trigger zone is (e.g. "200%" = 2x viewport height of scroll) */
  scrubDuration?: string
  /** Tailwind class for the dark overlay on top of the video */
  overlay?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    // Skip scroll-trigger setup on mobile — use autoplay fallback instead
    if (isMobile) return

    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    let cancelled = false

    // Wait for video metadata so we know the duration
    function setup() {
      if (cancelled || !video || !container) return

      // Kill any existing ScrollTrigger on this element
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === container) st.kill()
      })

      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: `bottom+=${scrubDuration} top`,
        pin: true,
        scrub: 0.5,
        onUpdate: (self) => {
          if (video.duration) {
            video.currentTime = self.progress * video.duration
          }
        },
      })
    }

    if (video.readyState >= 1) {
      setup()
    } else {
      video.addEventListener("loadedmetadata", setup, { once: true })
    }

    return () => {
      cancelled = true
      video.removeEventListener("loadedmetadata", setup)
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === container) st.kill()
      })
    }
  }, [scrubDuration, isMobile])

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden">
      {/* Video background — fills the section */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={src}
        poster={poster}
        muted
        playsInline
        preload={isMobile ? "metadata" : "auto"}
        /* On mobile, autoplay a looping video instead of scroll-scrubbing */
        autoPlay={isMobile}
        loop={isMobile}
      />

      {/* Dark overlay for text readability */}
      <div className={`absolute inset-0 ${overlay}`} />

      {/* Content pinned on top of the video */}
      <div className="relative z-10 flex h-full items-center justify-center">
        {children}
      </div>
    </div>
  )
}
