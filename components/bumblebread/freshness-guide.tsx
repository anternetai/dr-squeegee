import Image from "next/image"
import { BeeDecoration } from "./bee-decoration"

const tips = [
  {
    step: "Slice it",
    detail: "Slice the whole loaf when you get home — even if you're not eating it all today.",
  },
  {
    step: "Bag it",
    detail: "Place slices in a Ziplock bag, squeeze out the air, and freeze.",
  },
  {
    step: "Freeze it",
    detail: "Sourdough freezes beautifully for up to 3 months. Pull slices as you need them.",
  },
  {
    step: "Reheat it",
    detail: "Air Fryer at 400\u00B0F for 2\u20135 minutes. Toaster works too. Tastes fresh-baked every time.",
  },
]

export function FreshnessGuide() {
  return (
    <section className="relative px-6 py-20 md:py-28" style={{ backgroundColor: "var(--bb-cream-dark)" }}>
      {/* Decorative bee */}
      <div className="absolute top-10 left-8 md:left-20 opacity-40">
        <BeeDecoration className="w-6 h-6" variant={3} />
      </div>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h2
            className="text-2xl md:text-3xl font-bold mb-3"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            Keeping Your Sourdough Fresh
          </h2>
          <p
            className="italic"
            style={{ fontFamily: "var(--font-bb-accent)", color: "var(--bb-text-muted)", fontSize: "1rem" }}
          >
            Make every slice taste like it just came out of the oven
          </p>
        </div>

        {/* Freshness photo */}
        <div className="rounded-2xl overflow-hidden mb-12">
          <Image
            src="/bumblebread/freshness-guide.webp"
            alt="Sliced sourdough bread on a cutting board"
            width={600}
            height={400}
            className="w-full h-auto"
            loading="lazy"
          />
        </div>

        <div className="space-y-8">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  fontFamily: "var(--font-bb-heading)",
                  backgroundColor: "var(--bb-gold)",
                  color: "var(--bb-navy)",
                }}
              >
                {i + 1}
              </div>
              <div className="pt-1">
                <h3
                  className="font-bold mb-1"
                  style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
                >
                  {tip.step}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
                >
                  {tip.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
