import { BeeDecoration } from "./bee-decoration"

const steps = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
        <path d="M16 8v8l5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Watch for the drop",
    description: "New batches go live weekly on Instagram and right here.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 16l6 6 10-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="3" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    title: "Claim your loaf",
    description: "Order through the form or DM @bumblebreadclub.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 22c0-4 4-6 10-6s10 2 10 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="16" cy="12" rx="8" ry="5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 12v-2M16 12V9M20 12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Pick up your bread",
    description: "Local Charlotte pickup — we'll text you the details.",
  },
]

export function HowItWorks() {
  return (
    <section className="relative px-6 py-20 md:py-28">
      {/* Decorative bee */}
      <div className="absolute bottom-12 right-6 md:right-16 opacity-40">
        <BeeDecoration className="w-6 h-6" variant={2} />
      </div>

      <div className="max-w-md mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            How It Works
          </h2>
        </div>

        <div className="space-y-10">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "var(--bb-gold)" }}
                >
                  {step.icon}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px h-6" style={{ backgroundColor: "var(--bb-gold)", opacity: 0.2 }} />
                )}
              </div>
              <div className="pt-2">
                <h3
                  className="text-lg font-bold mb-1"
                  style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Instagram follow CTA */}
        <p
          className="text-center mt-14 text-sm"
          style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
        >
          Follow{" "}
          <a
            href="https://instagram.com/bumblebreadclub"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:opacity-80"
            style={{ color: "var(--bb-gold)" }}
          >
            @bumblebreadclub
          </a>{" "}
          for batch drops and behind-the-scenes
        </p>
      </div>
    </section>
  )
}
