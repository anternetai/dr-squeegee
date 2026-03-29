"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { MapPin, Plus, X, ChevronRight, Pencil, Trash2, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TerritoryKpis {
  total_doors: number
  doors_answered: number
  doors_pitched: number
  doors_closed: number
  contact_rate: number
  pitch_rate: number
  close_rate: number
  total_revenue: number
}

interface Territory {
  id: string
  name: string
  address: string | null
  center_lat: number | null
  center_lng: number | null
  zoom_level: number
  created_at: string
  kpis: TerritoryKpis
}

function contactRateColor(rate: number) {
  if (rate >= 0.25) return "text-green-600 dark:text-green-400"
  if (rate >= 0.15) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function closeRateColor(rate: number) {
  if (rate >= 0.2) return "text-green-600 dark:text-green-400"
  if (rate >= 0.1) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function pct(val: number) {
  return `${Math.round(val * 100)}%`
}

export default function CrmTerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newAddress, setNewAddress] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchTerritories = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/territories")
      if (res.ok) {
        const data = await res.json()
        setTerritories(data.territories ?? [])
      }
    } catch (err) {
      console.error("[territories] fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTerritories()
  }, [fetchTerritories])

  async function handleCreate() {
    const trimmed = newAddress.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/crm/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, address: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to create territory")
        return
      }
      setNewAddress("")
      setShowNew(false)
      fetchTerritories()
    } catch (err) {
      console.error("[territories] create error:", err)
      setError("Something went wrong")
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(oldName: string) {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === oldName) {
      setEditingId(null)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/territories/${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? "Failed to rename")
        return
      }
      setEditingId(null)
      fetchTerritories()
    } catch {
      alert("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    setDeletingId(name)
    try {
      const res = await fetch(`/api/crm/territories/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? "Failed to delete")
        return
      }
      setConfirmDeleteId(null)
      fetchTerritories()
    } catch {
      alert("Something went wrong")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Territories</h1>
          <p className="text-sm text-muted-foreground">Door knocking zones</p>
        </div>
        <Button
          onClick={() => { setShowNew(!showNew); setError(null) }}
          className="gap-2 bg-[#3A6B4C] hover:bg-[#2F5A3E] text-white"
          size="sm"
        >
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? "Cancel" : "New"}
        </Button>
      </div>

      {/* New Territory Form */}
      {showNew && (
        <div className="rounded-xl border border-[#3A6B4C]/30 bg-[#F0F7F2] dark:bg-[#0F1F15] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">New Territory</h2>
          <div className="space-y-1.5">
            <Label htmlFor="territory-address" className="text-xs text-muted-foreground">
              Street address or neighborhood name
            </Label>
            <Input
              id="territory-address"
              placeholder="e.g. Ballantyne Commons, Charlotte NC"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              className="text-base"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button
            onClick={handleCreate}
            disabled={creating || !newAddress.trim()}
            className="w-full bg-[#3A6B4C] hover:bg-[#2F5A3E] text-white font-semibold"
          >
            {creating ? "Creating…" : "Create Territory"}
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3A6B4C] border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && territories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">No territories yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Tap "+ New" to create your first door knocking zone.
          </p>
        </div>
      )}

      {/* Territory cards */}
      {!loading && territories.length > 0 && (
        <div className="space-y-3">
          {territories.map((t) => {
            const { kpis } = t
            const revenuePerDoor = kpis.total_doors > 0
              ? kpis.total_revenue / kpis.total_doors
              : 0
            const isEditing = editingId === t.id
            const isConfirmingDelete = confirmDeleteId === t.id
            const isDeleting = deletingId === t.name

            return (
              <div
                key={t.id}
                className="rounded-xl border border-border bg-card transition-colors"
              >
                <div className="p-4">
                  {/* Name + actions */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#3A6B4C]" />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRename(t.name); if (e.key === "Escape") setEditingId(null) }}
                          className="h-7 text-sm font-semibold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(t.name)}
                          disabled={saving}
                          className="p-1 rounded hover:bg-muted"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-[#3A6B4C]" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Link
                          href={`/crm/territories/${encodeURIComponent(t.name)}`}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#3A6B4C]" />
                          <span className="font-semibold text-foreground leading-tight truncate">{t.name}</span>
                        </Link>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingId(t.id); setEditName(t.name); setConfirmDeleteId(null) }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(isConfirmingDelete ? null : t.id); setEditingId(null) }}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <Link href={`/crm/territories/${encodeURIComponent(t.name)}`}>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {isConfirmingDelete && (
                    <div className="mb-2 ml-6 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      <p className="text-xs text-red-700 dark:text-red-300 flex-1">
                        Delete &ldquo;{t.name}&rdquo; and all {kpis.total_doors} doors?
                      </p>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => handleDelete(t.name)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                      </Button>
                      <button onClick={() => setConfirmDeleteId(null)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-800/30">
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  )}

                  {/* Address */}
                  {t.address && (
                    <p className="mb-2 text-xs text-muted-foreground pl-6 truncate">{t.address}</p>
                  )}

                  {/* KPI row — clickable to territory detail */}
                  <Link href={`/crm/territories/${encodeURIComponent(t.name)}`}>
                    <div className="grid grid-cols-4 gap-2 pl-6 hover:bg-muted/40 rounded-lg py-1 transition-colors">
                      <div className="text-center">
                        <p className="text-base font-bold text-foreground">{kpis.total_doors}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">doors</p>
                      </div>
                      <div className="text-center">
                        <p className={cn("text-base font-bold", contactRateColor(kpis.contact_rate))}>
                          {pct(kpis.contact_rate)}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">contact</p>
                      </div>
                      <div className="text-center">
                        <p className={cn("text-base font-bold", closeRateColor(kpis.close_rate))}>
                          {pct(kpis.close_rate)}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">close</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-foreground">
                          ${kpis.total_revenue > 0 ? kpis.total_revenue.toLocaleString() : "0"}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">revenue</p>
                      </div>
                    </div>
                  </Link>

                  {/* Footer row */}
                  <div className="mt-3 flex items-center gap-3 pl-6">
                    {revenuePerDoor > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${revenuePerDoor.toFixed(2)}/door
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
