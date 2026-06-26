"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

const STEPS = [
  {
    id: "domain",
    number: 1,
    name: "Buy a domain",
    desc: "Your website's home address — like thebumblebreadclub.com",
    tip: "Go to Namecheap, search for your name, and buy it. ~$12/year. Don't set anything else up yet — just buy it.",
    time: "5 min",
    url: "https://www.namecheap.com",
    label: "Go to Namecheap →",
  },
  {
    id: "github",
    number: 2,
    name: "GitHub",
    desc: "Where your website's code lives (like Google Drive, but for code)",
    tip: "Sign up free. Username suggestion: bumblebreadclub",
    time: "2 min",
    url: "https://github.com",
    label: "Sign up free →",
  },
  {
    id: "vercel",
    number: 3,
    name: "Vercel",
    desc: "Hosts your website for free so everyone can visit it",
    tip: "Sign up with your GitHub account — it's one click.",
    time: "2 min",
    url: "https://vercel.com/signup",
    label: "Sign up free →",
  },
  {
    id: "supabase",
    number: 4,
    name: "Supabase",
    desc: "Stores your orders and email list",
    tip: "Sign up free. This is where all your customer data lives.",
    time: "2 min",
    url: "https://supabase.com",
    label: "Sign up free →",
  },
  {
    id: "resend",
    number: 5,
    name: "Resend",
    desc: "Sends you an email every time someone places an order",
    tip: "Sign up free. Up to 3,000 emails/month — way more than enough.",
    time: "2 min",
    url: "https://resend.com",
    label: "Sign up free →",
  },
  {
    id: "claude",
    number: 6,
    name: "Claude ✨",
    desc: "The AI you'll use to make changes to your site yourself",
    tip: "After we transfer everything, you'll use Claude to update your menu, change wording, and more — no coding needed.",
    time: "2 min",
    url: "https://claude.ai",
    label: "Sign up free →",
    bonus: true,
  },
]

const TOGETHER = [
  "Move your site to your own Vercel account",
  "Connect your new domain",
  "Transfer your orders and subscriber list",
  "Set up emails from your own domain",
  "Claude walkthrough — how to update your menu and make changes yourself",
]

const STORAGE_KEY = "bb-onboarding-v1"
// TODO: replace with Anthony's personal cell
const ANTHONY_PHONE = "+19802428048"

export default function BumblebreadOnboardingPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setChecked(JSON.parse(saved))
      } catch {}
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
  }, [checked, mounted])

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  const doneCount = STEPS.filter(s => checked[s.id]).length
  const progress = (doneCount / STEPS.length) * 100
  const allDone = doneCount === STEPS.length

  if (!mounted) return null

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bb-cream)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Image
            src="/bumblebread/wordmark-t.webp"
            alt="The Bumblebread Club"
            width={200}
            height={54}
            style={{ margin: "0 auto", height: "auto" }}
          />
        </div>

        {/* Mascot */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <Image
            src="/bumblebread/mascot-smelling.webp"
            alt="Bumblebread mascot"
            width={110}
            height={110}
            style={{ margin: "0 auto", height: "auto" }}
          />
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "var(--font-bb-heading)",
            fontSize: 26,
            fontWeight: 800,
            color: "var(--bb-navy)",
            marginBottom: 12,
            lineHeight: 1.25,
          }}>
            Hey Bianca! 🍞<br />Your website is almost yours.
          </h1>
          <p style={{
            fontFamily: "var(--font-bb-body)",
            fontSize: 15,
            color: "var(--bb-text-muted)",
            lineHeight: 1.65,
          }}>
            Complete these steps on your own — takes about{" "}
            <strong style={{ color: "var(--bb-navy)" }}>15 minutes total</strong>{" "}
            — then text Anthony and you&apos;ll do the rest together.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: "var(--font-bb-accent)",
              fontSize: 16,
              color: "var(--bb-navy)",
              fontWeight: 600,
            }}>
              {doneCount === 0
                ? "Let's go! 🐝"
                : allDone
                ? "You're all done! 🎉"
                : `${doneCount} of ${STEPS.length} done`}
            </span>
            <span style={{
              fontFamily: "var(--font-bb-body)",
              fontSize: 13,
              color: "var(--bb-text-muted)",
            }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: "var(--bb-cream-dark)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: "var(--bb-gold)",
              borderRadius: 999,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* Phase 1 heading */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{
            fontFamily: "var(--font-bb-heading)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--bb-navy)",
            marginBottom: 4,
          }}>
            Do these on your own
          </h2>
          <p style={{
            fontFamily: "var(--font-bb-body)",
            fontSize: 14,
            color: "var(--bb-text-muted)",
          }}>
            No tech experience needed — each one has a direct link and takes 2 minutes.
          </p>
        </div>

        {/* Step cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {STEPS.map(step => {
            const done = !!checked[step.id]
            return (
              <div
                key={step.id}
                style={{
                  backgroundColor: done ? "#F5EFE3" : "#fff",
                  border: `2px solid ${done ? "var(--bb-gold)" : "#E8E2D9"}`,
                  borderRadius: 16,
                  padding: step.bonus ? "24px 16px 16px" : "16px",
                  position: "relative",
                  transition: "border-color 0.2s, background-color 0.2s",
                }}
              >
                {step.bonus && (
                  <div style={{
                    position: "absolute",
                    top: -11,
                    left: 16,
                    backgroundColor: "var(--bb-gold)",
                    color: "#fff",
                    fontSize: 11,
                    fontFamily: "var(--font-bb-accent)",
                    fontWeight: 700,
                    padding: "3px 12px",
                    borderRadius: 999,
                    letterSpacing: 0.5,
                  }}>
                    bonus step
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Step number badge */}
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backgroundColor: done ? "var(--bb-gold)" : "var(--bb-navy)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-bb-heading)",
                    fontSize: 15,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: "background-color 0.2s",
                  }}>
                    {done ? "✓" : step.number}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontFamily: "var(--font-bb-heading)",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--bb-navy)",
                        textDecoration: done ? "line-through" : "none",
                        opacity: done ? 0.55 : 1,
                        transition: "opacity 0.2s",
                      }}>
                        {step.name}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-bb-body)",
                        fontSize: 12,
                        color: "var(--bb-text-muted)",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}>
                        ~{step.time}
                      </span>
                    </div>

                    <p style={{
                      fontFamily: "var(--font-bb-body)",
                      fontSize: 14,
                      color: "var(--bb-text)",
                      marginBottom: 5,
                      lineHeight: 1.5,
                    }}>
                      {step.desc}
                    </p>
                    <p style={{
                      fontFamily: "var(--font-bb-body)",
                      fontSize: 12,
                      color: "var(--bb-text-muted)",
                      marginBottom: 14,
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}>
                      {step.tip}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          backgroundColor: "var(--bb-navy)",
                          color: "#fff",
                          fontFamily: "var(--font-bb-body)",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "8px 16px",
                          borderRadius: 999,
                          textDecoration: "none",
                        }}
                      >
                        {step.label}
                      </a>
                      <button
                        onClick={() => toggle(step.id)}
                        style={{
                          backgroundColor: done ? "var(--bb-gold)" : "transparent",
                          border: `2px solid ${done ? "var(--bb-gold)" : "#D4CECC"}`,
                          borderRadius: 999,
                          padding: "6px 14px",
                          fontFamily: "var(--font-bb-body)",
                          fontSize: 13,
                          fontWeight: 600,
                          color: done ? "#fff" : "var(--bb-text-muted)",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {done ? "Done ✓" : "Mark done"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Phase 2 — Together */}
        <div style={{
          backgroundColor: "var(--bb-navy)",
          borderRadius: 20,
          padding: "24px 20px",
          marginBottom: 36,
        }}>
          <h2 style={{
            fontFamily: "var(--font-bb-heading)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--bb-gold)",
            marginBottom: 6,
          }}>
            We&apos;ll do this together 🤝
          </h2>
          <p style={{
            fontFamily: "var(--font-bb-body)",
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            marginBottom: 16,
            lineHeight: 1.6,
          }}>
            Once you&apos;ve finished the steps above, Anthony handles everything else. Here&apos;s what we&apos;ll do when we meet:
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {TOGETHER.map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>🍯</span>
                <span style={{
                  fontFamily: "var(--font-bb-body)",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 1.5,
                }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          {allDone ? (
            <>
              <div style={{
                fontFamily: "var(--font-bb-accent)",
                fontSize: 26,
                color: "var(--bb-navy)",
                marginBottom: 10,
                lineHeight: 1.3,
              }}>
                You crushed it!! 🎉🍞🐝
              </div>
              <p style={{
                fontFamily: "var(--font-bb-body)",
                fontSize: 15,
                color: "var(--bb-text-muted)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}>
                Text Anthony and you&apos;re ready to get together!
              </p>
              <a
                href={`sms:${ANTHONY_PHONE}&body=Hey! I finished all the onboarding steps for BumbleBread 🍞`}
                style={{
                  display: "inline-block",
                  backgroundColor: "var(--bb-gold)",
                  color: "#fff",
                  fontFamily: "var(--font-bb-heading)",
                  fontSize: 17,
                  fontWeight: 700,
                  padding: "16px 32px",
                  borderRadius: 999,
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(201,168,76,0.4)",
                }}
              >
                Text Anthony — I&apos;m ready! 🎉
              </a>
            </>
          ) : (
            <>
              <p style={{
                fontFamily: "var(--font-bb-body)",
                fontSize: 14,
                color: "var(--bb-text-muted)",
                marginBottom: 8,
              }}>
                Questions along the way?
              </p>
              <a
                href={`sms:${ANTHONY_PHONE}`}
                style={{
                  fontFamily: "var(--font-bb-body)",
                  fontSize: 14,
                  color: "var(--bb-navy)",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Text Anthony 💬
              </a>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
