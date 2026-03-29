"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, DollarSign, Calendar, Clock } from "lucide-react"
import type { DoorVisit } from "@/lib/the-move/types"

type Step = "answer" | "pitch" | "close" | "notes"

interface DoorLogOverlayProps {
  onComplete: (visit: DoorVisit) => void
  onCancel: () => void
  isRevisit?: boolean
  doorInfo?: string
}

export function DoorLogOverlay({ onComplete, onCancel, isRevisit, doorInfo }: DoorLogOverlayProps) {
  const now = new Date()
  const [step, setStep] = useState<Step>("answer")
  const [visit, setVisit] = useState<Partial<DoorVisit>>({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    answered: false,
  })
  const [notes, setNotes] = useState("")
  const [revenue, setRevenue] = useState("")
  const [showNotes, setShowNotes] = useState(false)

  function finish() {
    onComplete({
      date: visit.date!,
      time: visit.time || undefined,
      answered: visit.answered ?? false,
      pitched: visit.pitched,
      closed: visit.closed,
      not_interested: visit.not_interested,
      notes: notes || undefined,
      revenue: revenue ? Number(revenue) : undefined,
    })
  }

  return (
    <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-xl border border-stone-700 bg-stone-900/95 p-4 backdrop-blur">
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-2 right-2 text-stone-500 hover:text-stone-300"
      >
        <X className="size-4" />
      </button>

      {isRevisit && doorInfo && (
        <p className="mb-2 text-center text-xs text-amber-400">Re-visiting: {doorInfo}</p>
      )}

      {/* Step 1: Did they answer? */}
      {step === "answer" && (
        <div className="space-y-3">
          {/* Date + Time row */}
          <div className="flex items-center gap-2 justify-center">
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-stone-500" />
              <input
                type="date"
                value={visit.date}
                onChange={(e) => setVisit({ ...visit, date: e.target.value })}
                className="h-8 w-[130px] rounded-md border border-stone-700 bg-stone-800 pl-7 pr-2 text-xs text-stone-200"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-stone-500" />
              <input
                type="time"
                value={visit.time}
                onChange={(e) => setVisit({ ...visit, time: e.target.value })}
                className="h-8 w-[110px] rounded-md border border-stone-700 bg-stone-800 pl-7 pr-2 text-xs text-stone-200"
              />
            </div>
          </div>
          <p className="text-center text-sm font-medium text-stone-300">Did they answer?</p>
          <div className="flex justify-center gap-3">
            <Button
              onClick={() => {
                setVisit({ ...visit, answered: true })
                setStep("pitch")
              }}
              className="h-12 w-28 bg-green-600 hover:bg-green-500 text-white font-bold"
            >
              Yes
            </Button>
            <Button
              onClick={() => {
                setVisit({ ...visit, answered: false })
                setShowNotes(true)
                setStep("notes")
              }}
              className="h-12 w-28 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold"
            >
              No
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Did you pitch? */}
      {step === "pitch" && (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-stone-300">Did you pitch?</p>
          <div className="flex justify-center gap-3">
            <Button
              onClick={() => {
                setVisit({ ...visit, pitched: true })
                setStep("close")
              }}
              className="h-12 w-28 bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              Yes
            </Button>
            <Button
              onClick={() => {
                setVisit({ ...visit, pitched: false })
                setStep("notes")
                setShowNotes(true)
              }}
              className="h-12 w-28 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold"
            >
              Just Talked
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Did you close? */}
      {step === "close" && (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-stone-300">Did you close?</p>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => {
                setVisit({ ...visit, closed: true })
                setShowNotes(true)
                setStep("notes")
              }}
              className="h-12 w-24 bg-green-600 hover:bg-green-500 text-white font-bold"
            >
              Yes!
            </Button>
            <Button
              onClick={() => {
                setVisit({ ...visit, closed: false })
                setShowNotes(true)
                setStep("notes")
              }}
              className="h-12 w-24 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold"
            >
              Not Yet
            </Button>
            <Button
              onClick={() => {
                setVisit({ ...visit, not_interested: true })
                setShowNotes(true)
                setStep("notes")
              }}
              variant="destructive"
              className="h-12 w-24 font-bold"
            >
              Not Int.
            </Button>
          </div>
        </div>
      )}

      {/* Notes (optional at any terminal step) */}
      {step === "notes" && (
        <div className="space-y-3">
          <p className="text-center text-xs text-stone-500">
            {visit.answered ? (visit.closed ? "Closed!" : visit.not_interested ? "Not interested" : visit.pitched ? "Pitched" : "Talked") : "No answer"}
          </p>

          {visit.closed && (
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-green-400" />
              <Input
                type="number"
                placeholder="Revenue"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="pl-9 bg-stone-800 border-stone-700 text-stone-200"
              />
            </div>
          )}

          {showNotes && (
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-stone-800 border-stone-700 text-stone-200"
              autoFocus
            />
          )}

          <Button
            onClick={() => finish()}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
