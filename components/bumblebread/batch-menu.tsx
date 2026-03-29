"use client"

import { useState } from "react"
import Image from "next/image"
import { BeeDecoration } from "./bee-decoration"
import { OrderForm } from "./order-form"

type LoafStatus = "available" | "few_left" | "sold_out"

interface Loaf {
  name: string
  description: string
  price: string
  status: LoafStatus
  image: string
}

// Current batch data — update weekly
const BATCH = {
  name: "Batch #4",
  date: "03.27",
  loaves: [
    {
      name: "Doja's Loaf",
      description: "Classic round sourdough boule",
      price: "$9",
      status: "available" as LoafStatus,
      image: "/bumblebread/loaf-dojas.webp",
    },
    {
      name: "Ed's Loaf",
      description: "Sandwich style sourdough loaf",
      price: "$9",
      status: "available" as LoafStatus,
      image: "/bumblebread/loaf-eds.webp",
    },
    {
      name: "Livet's Loaf",
      description: "Elongated artisan sourdough loaf",
      price: "$9",
      status: "few_left" as LoafStatus,
      image: "/bumblebread/loaf-livets.webp",
    },
  ] satisfies Loaf[],
}

const statusBadge: Record<LoafStatus, { label: string; bg: string; text: string; className?: string }> = {
  available: { label: "Available", bg: "#E8F5E9", text: "#2E7D32" },
  few_left: { label: "Few Left", bg: "#FFF3E0", text: "#E65100" },
  sold_out: { label: "Sold Out", bg: "#FFEBEE", text: "#C62828", className: "badge-sold-out" },
}

export function BatchMenu() {
  const [showOrder, setShowOrder] = useState(false)
  const [selectedLoaf, setSelectedLoaf] = useState<string | null>(null)

  const availableLoaves = BATCH.loaves.filter((l) => l.status !== "sold_out")

  function handleOrderClick(loafName: string) {
    setSelectedLoaf(loafName)
    setShowOrder(true)
  }

  return (
    <section id="batch" className="relative px-6 pt-10 pb-20 md:pb-28">
      {/* Floating bee — near the wordmark */}
      <div className="absolute -top-4 right-8 md:right-24">
        <BeeDecoration className="w-8 h-8" variant={1} />
      </div>

      {/* Mascot peeking from right edge */}
      <div className="absolute right-0 top-8 w-16 md:w-20 overflow-hidden opacity-70">
        <Image
          src="/bumblebread/mascot-peeking.webp"
          alt=""
          width={512}
          height={512}
          className="w-full h-auto"
          aria-hidden="true"
        />
      </div>

      <div className="max-w-lg mx-auto">
        {/* Batch header */}
        <div className="text-center mb-14">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-3"
            style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
          >
            This Week
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            {BATCH.name}
          </h2>
          <p
            className="text-lg"
            style={{ fontFamily: "var(--font-bb-accent)", color: "var(--bb-gold)", fontSize: "1.3rem" }}
          >
            {BATCH.date}
          </p>
        </div>

        {/* Loaf cards */}
        <div className="space-y-8">
          {BATCH.loaves.map((loaf) => {
            const badge = statusBadge[loaf.status]
            return (
              <div
                key={loaf.name}
                className="rounded-2xl p-5 transition-all duration-200"
                style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
              >
                <div className="flex gap-4">
                  {/* Loaf photo */}
                  <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden">
                    <Image
                      src={loaf.image}
                      alt={loaf.name}
                      width={192}
                      height={192}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name + price */}
                    <div className="flex items-baseline justify-between mb-1">
                      <h3
                        className="text-lg font-bold"
                        style={{ fontFamily: "var(--font-bb-heading)" }}
                      >
                        {loaf.name}
                      </h3>
                      <span
                        className="text-lg font-bold ml-2"
                        style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-gold)" }}
                      >
                        {loaf.price}
                      </span>
                    </div>

                    {/* Dotted line separator */}
                    <div className="menu-leader mb-2" style={{ margin: 0 }} />

                    {/* Description */}
                    <p
                      className="text-sm mb-3"
                      style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
                    >
                      {loaf.description}
                    </p>

                    {/* Status + order */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium px-3 py-1 rounded-full ${badge.className || ""}`}
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                      {loaf.status !== "sold_out" && (
                        <button
                          onClick={() => handleOrderClick(loaf.name)}
                          className="text-xs font-semibold px-4 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                          style={{
                            fontFamily: "var(--font-bb-body)",
                            backgroundColor: "var(--bb-navy)",
                            color: "var(--bb-cream)",
                          }}
                        >
                          Order This Loaf
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Preslice note */}
        <p
          className="text-center mt-10 italic"
          style={{ fontFamily: "var(--font-bb-accent)", color: "var(--bb-text-muted)", fontSize: "1rem" }}
        >
          * Preslice available upon request
        </p>
      </div>

      {/* Order form modal */}
      {showOrder && (
        <OrderForm
          availableLoaves={availableLoaves}
          preselected={selectedLoaf}
          onClose={() => {
            setShowOrder(false)
            setSelectedLoaf(null)
          }}
        />
      )}
    </section>
  )
}
