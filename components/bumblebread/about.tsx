import Image from "next/image"
import { BeeDecoration } from "./bee-decoration"

export function About() {
  return (
    <section className="relative px-6 py-20 md:py-28">
      {/* Decorative bee — top-right */}
      <div className="absolute top-16 right-6 md:right-16 opacity-50">
        <BeeDecoration className="w-7 h-7" variant={2} />
      </div>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-8" style={{ backgroundColor: "var(--bb-gold)" }} />
            <BeeDecoration className="w-5 h-5" variant={1} />
            <span className="h-px w-8" style={{ backgroundColor: "var(--bb-gold)" }} />
          </div>
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            About The Club
          </h2>
        </div>

        {/* Baking photo */}
        <div className="rounded-2xl overflow-hidden mb-10 max-w-sm mx-auto">
          <Image
            src="/bumblebread/about-baking.webp"
            alt="Hands shaping sourdough bread dough"
            width={480}
            height={360}
            className="w-full h-auto"
            loading="lazy"
          />
        </div>

        <div
          className="space-y-5 text-base leading-relaxed text-center"
          style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
        >
          <p>
            The Bumblebread Club started with a simple love for sourdough &mdash;
            the slow ferment, the golden crust, the way a warm loaf brings people together.
          </p>
          <p>
            Every loaf is handmade in small batches using quality ingredients and a whole lot of patience.
            No shortcuts, no preservatives, just real bread the way it&apos;s meant to be.
          </p>
          <p>
            The names? They each have a story. Doja, Ed, Livet &mdash; every loaf is named
            for someone or something that inspires the bake. That&apos;s what makes this a club, not just a bakery.
          </p>
        </div>

        <p
          className="mt-10 text-center italic"
          style={{ fontFamily: "var(--font-bb-accent)", color: "var(--bb-gold)", fontSize: "1.25rem" }}
        >
          A microbakery born from love of sourdough and community
        </p>
      </div>
    </section>
  )
}
