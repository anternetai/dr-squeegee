import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DoorOpen, MapPin, DollarSign, Target, Phone, User } from "lucide-react"
import Link from "next/link"

// Reads the standalone Doors app's tables directly (same shared Supabase,
// different app — anternetai/doors, tables `territories` +
// `doors_territory_doors`). NOT the CRM's own pre-existing /crm/territories
// ("the-move") feature, which is a separate personal tracker on different
// tables (territory_doors / door_knocks) — this page is specifically the
// Doors-app activity feed the CRM didn't have before.
interface DoorRow {
  id: string
  territory_id: string
  status: string
  total_visits: number
  contact_name: string | null
  contact_phone: string | null
  crm_client_id: string | null
  crm_job_id: string | null
  created_at: string
  visits: { date: string; closed?: boolean; revenue?: number; not_interested?: boolean; answered?: boolean }[]
}

interface TerritoryRow {
  id: string
  name: string
}

function statusLabel(status: string) {
  switch (status) {
    case "closed": return "Closed"
    case "not_interested": return "Not interested"
    case "pitched": return "Pitched"
    case "answered": return "Answered"
    default: return "Not home"
  }
}

function statusColor(status: string) {
  switch (status) {
    case "closed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    case "not_interested": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
    case "pitched": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    case "answered": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    default: return "bg-muted text-muted-foreground"
  }
}

export default async function KnocksPage() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: territories }, { data: doors }] = await Promise.all([
    admin.from("territories").select("id, name").order("name", { ascending: true }),
    admin
      .from("doors_territory_doors")
      .select("id, territory_id, status, total_visits, contact_name, contact_phone, crm_client_id, crm_job_id, created_at, visits")
      .order("created_at", { ascending: false }),
  ])

  const allTerritories = (territories || []) as TerritoryRow[]
  const allDoors = (doors || []) as DoorRow[]
  const territoryName = new Map(allTerritories.map((t) => [t.id, t.name]))

  const perTerritory = allTerritories.map((t) => {
    const tDoors = allDoors.filter((d) => d.territory_id === t.id)
    const closed = tDoors.filter((d) => d.status === "closed")
    const revenue = closed.reduce((sum, d) => {
      const lastClose = [...d.visits].reverse().find((v) => v.closed)
      return sum + (lastClose?.revenue ?? 0)
    }, 0)
    return { ...t, doorCount: tDoors.length, closedCount: closed.length, revenue }
  }).filter((t) => t.doorCount > 0)

  const totalDoors = allDoors.length
  const totalClosed = allDoors.filter((d) => d.status === "closed").length
  const totalRevenue = perTerritory.reduce((sum, t) => sum + t.revenue, 0)
  const withContact = allDoors.filter((d) => d.contact_name || d.contact_phone).length

  const recentClosed = allDoors.filter((d) => d.status === "closed").slice(0, 20)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Knocks</h1>
        <p className="text-sm text-muted-foreground">
          Door-to-door activity from the Doors app — read-only feed, not editable here.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Doors knocked", value: totalDoors, icon: DoorOpen },
          { label: "Closed", value: totalClosed, icon: Target },
          { label: "Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign },
          { label: "With contact info", value: withContact, icon: User },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-[#2D8C6F]" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalDoors === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <DoorOpen className="h-9 w-9 mx-auto mb-3 opacity-25" />
            <p className="text-sm">No door-knock activity yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Per-territory breakdown */}
      {perTerritory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#2D8C6F]" />
              By territory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {perTerritory.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.doorCount} door{t.doorCount !== 1 ? "s" : ""} · {t.closedCount} closed
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">
                    {t.revenue > 0 ? `$${t.revenue.toLocaleString()}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent closes */}
      {recentClosed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-[#2D8C6F]" />
              Recent closes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentClosed.map((d) => {
                const lastClose = [...d.visits].reverse().find((v) => v.closed)
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {d.contact_name || "No contact captured"}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor(d.status)}`}>
                          {statusLabel(d.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {territoryName.get(d.territory_id) ?? "Unknown territory"}
                        {d.contact_phone ? ` · ${d.contact_phone}` : ""}
                        {lastClose?.date ? ` · ${lastClose.date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {lastClose?.revenue != null && (
                        <span className="text-sm font-medium">${Number(lastClose.revenue).toFixed(2)}</span>
                      )}
                      {d.crm_client_id ? (
                        <Link
                          href={`/crm/clients/${d.crm_client_id}`}
                          className="text-xs text-[#2D8C6F] hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          View client
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not linked</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
