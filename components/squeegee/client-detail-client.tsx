"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin, FileText, Pencil, Save, X, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  client: SqueegeeClient
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value?: string | null
  className?: string
}) {
  if (!value) return null
  const isAddress = label === "Address"
  const isPhone = label === "Phone"
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {isAddress ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#3A6B4C] hover:underline"
          >
            {value}
          </a>
        ) : isPhone ? (
          <a
            href={`sms:${value.replace(/[^\d+]/g, "")}`}
            className="text-sm text-[#3A6B4C] hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  )
}

export function ClientDetailClient({ client: initialClient }: Props) {
  const router = useRouter()
  const [client, setClient] = useState(initialClient)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState(false)

  const [editForm, setEditForm] = useState({
    name: client.name,
    phone: client.phone || "",
    email: client.email || "",
    address: client.address || "",
    notes: client.notes || "",
  })

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${client.name}"? This cannot be undone. Any jobs linked to this client will be unlinked but not deleted.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/squeegee/clients/${client.id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(`Failed to delete client: ${body.error ?? "Unknown error"}`)
        setDeleting(false)
        return
      }
      router.push("/crm/clients")
    } catch {
      alert("Network error — please try again.")
      setDeleting(false)
    }
  }

  function startEdit() {
    setEditForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      notes: client.notes || "",
    })
    setEditing(true)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) {
      setEditError("Name is required.")
      return
    }

    setSaving(true)
    setEditError(null)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("squeegee_clients")
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", client.id)
      .select("*")
      .single()

    if (error) {
      setEditError(error.message)
    } else if (data) {
      setClient(data as SqueegeeClient)
      setEditing(false)
      router.refresh()
    }
    setSaving(false)
  }

  if (editing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Edit Client</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={saving}
                className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {editError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Client Info</CardTitle>
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Phone} label="Phone" value={client.phone} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={MapPin} label="Address" value={client.address} className="sm:col-span-2" />
            {client.notes && (
              <div className="sm:col-span-2 flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
            {!client.phone && !client.email && !client.address && !client.notes && (
              <p className="sm:col-span-2 text-sm text-muted-foreground italic">
                No details saved yet.{" "}
                <button onClick={startEdit} className="underline text-[#3A6B4C]">
                  Add some
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this client</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently removes the client. Linked jobs will be unlinked, not deleted.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete Client
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
