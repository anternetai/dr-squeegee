import { Hero } from "@/components/bumblebread/hero"
import { BatchMenu } from "@/components/bumblebread/batch-menu"
import { MascotDivider } from "@/components/bumblebread/mascot-divider"
import { HowItWorks } from "@/components/bumblebread/how-it-works"
import { FreshnessGuide } from "@/components/bumblebread/freshness-guide"
import { About } from "@/components/bumblebread/about"
import { JoinClub } from "@/components/bumblebread/join-club"
import { Footer } from "@/components/bumblebread/footer"

export default function BumblebreadPage() {
  return (
    <main>
      <Hero />

      <BatchMenu />

      <HowItWorks />

      <FreshnessGuide />

      {/* Original mascot before the About section */}
      <MascotDivider
        src="/bumblebread/mascot-og.webp"
        alt="The Bumblebread Club mascot"
        width={607}
        height={879}
        position="center"
        className="-mb-8 mt-2"
      />

      <About />

      {/* Mascot breaking bread — community feel before signup */}
      <MascotDivider
        src="/bumblebread/mascot-breaking-bread.webp"
        alt="Bumblebread mascot breaking bread"
        width={495}
        height={518}
        position="center"
        className="-mt-2 -mb-6"
      />

      <JoinClub />
      <Footer />
    </main>
  )
}
