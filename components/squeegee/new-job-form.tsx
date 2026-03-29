"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

interface Props {
  client?: SqueegeeClient | null
}

export function NewJobForm({ client }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_name: client?.name || "",
    client_phone: client?.phone || "",
    client_email: client?.email || "",
    address: client?.address || "",
    notes: "",
  })

  const hasClient = !!client

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!form.client_name.trim()) {
      setError("Client name is required.")
      setLoading(false)
      return
    }
    if (!form.address.trim()) {
      setError("Address is required.")
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error: dbError } = await supabase
      .from("squeegee_jobs")
      .insert({
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim() || null,
        client_email: form.client_email.trim() || null,
        address: form.address.trim(),
        service_type: "Pending Quote",
        notes: form.notes.trim() || null,
        status: "new",
        client_id: client?.id || null,
      })
      .select("id")
      .single()

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }

    router.push(`/crm/jobs/${data.id}`)
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client info */}
          <div className="space-y-1">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Client Info
            </h2>
            {hasClient && (
              <p className="text-xs text-muted-foreground">
                Pre-filled from client record. Edit if needed.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_name">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client_name"
                placeholder="Jane Smith"
                value={form.client_name}
                onChange={(e) => handleChange("client_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client_phone">Phone</Label>
              <Input
                id="client_phone"
                type="tel"
                placeholder="(704) 555-1234"
                value={form.client_phone}
                onChange={(e) => handleChange("client_phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client_email">Email</Label>
              <Input
                id="client_email"
                type="email"
                placeholder="jane@example.com"
                value={form.client_email}
                onChange={(e) => handleChange("client_email", e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-1">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Job Details
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">
                Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder="123 Main St, Charlotte, NC 28201"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about the job, property access, special instructions…"
                rows={3}
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Services and pricing are set when you send a quote from the job page.
          </p>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
