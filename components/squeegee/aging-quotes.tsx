"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Hourglass, Copy, Check, ExternalLink, MessageCircleQuestion } from "lucide-react"

export interface AgingItem {
  id: string
  kind: "quote" | "plan"
  clientName: string
  amount: number
  createdAt: string
  publicPath: string // e.g. /q/abc123 or /a/abc123
  crmPath: string // e.g. /crm/jobs/uuid or /crm/plans/uuid
  needsReply: boolean // quote status === "help" — customer asked a question
  label: string // "Quote" or the plan name
}

function daysOut(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
}

function ageClasses(days: number): string {
  if (days >= 7) return "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]"
  if (days >= 3) return "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]"
  return "bg-muted text-muted-foreground"
}

function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      title="Copy link to re-text"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // clipboard blocked (http/permissions) — fall back to prompt
          window.prompt("Copy the link:", `${window.location.origin}${path}`)
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-[var(--crm-accent)]" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export function AgingQuotes({
  items,
  staleCount,
  staleTotal,
}: {
  items: AgingItem[]
  staleCount: number
  staleTotal: number
}) {
  const total = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const shown = items.slice(0, 8)

  return (
    <Card className="border-[var(--crm-attention-bg)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[var(--crm-attention-bg)]">
              <Hourglass className="h-4 w-4 text-[var(--crm-attention)]" />
            </div>
            <CardTitle className="text-base">Waiting on a yes</CardTitle>
          </div>
          {items.length > 0 && (
            <span className="text-sm font-semibold text-[var(--crm-attention)]">
              ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })} outstanding
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Nothing in the last 45 days waiting on an answer.
            {staleCount > 0 && ` (${staleCount} older pending quotes — probably dead.)`}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((item) => {
              const days = daysOut(item.createdAt)
              return (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between px-6 py-3">
                  <Link href={item.crmPath} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                    <p className="font-medium text-sm truncate">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.label}
                      {item.needsReply && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[var(--crm-accent)] font-medium">
                          <MessageCircleQuestion className="h-3 w-3" /> asked a question
                        </span>
                      )}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-sm font-medium">
                      ${Number(item.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ageClasses(days)}`}>
                      {days}d
                    </span>
                    <CopyLinkButton path={item.publicPath} />
                    <Button variant="ghost" size="sm" className="h-8 px-2" asChild title="Open customer view">
                      <a href={item.publicPath} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )
            })}
            {(items.length > shown.length || staleCount > 0) && (
              <p className="px-6 py-2.5 text-xs text-muted-foreground">
                {items.length > shown.length && `+ ${items.length - shown.length} more in the window`}
                {items.length > shown.length && staleCount > 0 && " · "}
                {staleCount > 0 &&
                  `${staleCount} stale (45d+, $${staleTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}) — likely dead`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
