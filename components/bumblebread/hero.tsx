import Image from "next/image"

export function Hero() {
  return (
    <section className="relative px-6 pt-10 pb-6 text-center overflow-hidden">
      {/* Background bread photo — very subtle texture */}
      <div className="absolute inset-0 opacity-[0.05]">
        <Image
          src="/bumblebread/hero-bread.webp"
          alt=""
          fill
          className="object-cover"
          priority
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10">
        {/* Wordmark logo — compact, brand identity */}
        <h1>
          <span className="sr-only">The Bumblebread Club</span>
          <Image
            src="/bumblebread/wordmark-t.webp"
            alt="The Bumblebread Club"
            width={500}
            height={200}
            className="w-56 md:w-72 h-auto mx-auto"
            priority
          />
        </h1>

        {/* Tagline */}
        <p
          className="mt-4 text-base md:text-lg max-w-xs mx-auto leading-relaxed italic"
          style={{
            fontFamily: "var(--font-bb-accent)",
            color: "var(--bb-text-muted)",
          }}
        >
          A microbakery offering weekly limited sourdough
        </p>
      </div>
    </section>
  )
}
