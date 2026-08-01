import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { DoorOpen, UserPlus, AlertTriangle } from "lucide-react"
import { StatTile, CountTabs } from "@/components/squeegee/crm/stat-tile"
import { has } from "@/lib/crm/modules"
import {
  doorState, DOOR_STATE_LABEL, type DoorState, type TerritoryDoor,
} from "@/lib/crm/field/types"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STATE_TONE: Record<DoorState, string> = {
  won: "bg-[var(--crm-active-bg)] text-[var(--crm-active)]",
  answered: "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]",
  dead: "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]",
  unworked: "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)]",
}

const ORDER: DoorState[] = ["won", "answered", "dead", "unworked"]

/** "Apr 2, 11:28am". Parsed as a plain date, not UTC, so a knock logged in the
 *  evening doesn't display as the next day. */
function formatKnockDate(date: string, time?: string): string {
  if (!date) return ""
  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return date
  const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  if (!time) return label
  const [hh, mm] = time.split(":").map(Number)
  if (Number.isNaN(hh)) return label
  const suffix = hh >= 12 ? "pm" : "am"
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${label}, ${h12}:${String(mm ?? 0).padStart(2, "0")}${suffix}`
}

export default async function KnocksPage({
  searchParams,
}: {
  searchParams: Promise<{ territory?: string; state?: string }>
}) {
  const { territory: territoryId, state: stateFilter } = await searchParams
  const supabase = getAdmin()

  const [{ data: territoryRows }, { data: doorRows }] = await Promise.all([
    supabase.from("territories").select("id, name").order("name"),
    supabase
      .from("doors_territory_doors")
      .select(
        "id, territory_id, lat, lng, status, total_visits, contact_name, contact_phone, contact_address, crm_client_id, crm_job_id, created_at, visits"
      )
      .order("created_at", { ascending: false }),
  ])

  const territories = (territoryRows ?? []) as { id: string; name: string }[]
  const territoryName = new Map(territories.map((t) => [t.id, t.name]))

  const all = (doorRows ?? []).map((d) => ({
    ...d,
    visits: Array.isArray(d.visits) ? d.visits : [],
  })) as TerritoryDoor[]

  const scoped = territoryId ? all.filter((d) => d.territory_id === territoryId) : all

  const counts = ORDER.reduce((acc, s) => {
    acc[s] = scoped.filter((d) => doorState(d) === s).length
    return acc
  }, {} as Record<DoorState, number>)

  const activeState = ORDER.includes(stateFilter as DoorState)
    ? (stateFilter as DoorState)
    : null

  const visible = activeState
    ? scoped.filter((d) => doorState(d) === activeState)
    : scoped

  // The actually-actionable queue: someone gave a name or a number at the
  // door and it never became a client.
  const unclaimed = scoped.filter(
    (d) => (d.contact_name || d.contact_phone) && !d.crm_client_id
  )

  // Verified 2026-07-31: all 325 live doors have null contact_name/phone/address,
  // which is exactly why none ever bridged to a client. Closes with no way to
  // reach the customer again is the finding worth surfacing, not an empty tray.
  const anyContact = scoped.some((d) => d.contact_name || d.contact_phone)
  const closedCount = scoped.filter((d) => doorState(d) === "won").length

  const revenue = scoped.reduce(
    (sum, d) => sum + (d.visits ?? []).reduce((s, v) => s + (v.revenue ?? 0), 0),
    0
  )

  function qs(next: Record<string, string | null>) {
    const p = new URLSearchParams()
    if (territoryId) p.set("territory", territoryId)
    if (activeState) p.set("state", activeState)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const s = p.toString()
    return s ? `/crm/field/knocks?${s}` : "/crm/field/knocks"
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Knocks</h2>
        <p className="mt-0.5 text-sm text-[var(--crm-text-dim)]">
          {territoryId ? (
            <>
              {territoryName.get(territoryId) ?? "Territory"} ·{" "}
              <Link href="/crm/field/knocks" className="text-[var(--crm-accent)] hover:underline">
                show all territories
              </Link>
            </>
          ) : (
            <>{scoped.length.toLocaleString()} doors logged in the field</>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Doors" value={scoped.length.toLocaleString()} />
        <StatTile
          label="Closed at the door"
          value={`$${revenue.toLocaleString()}`}
          tone={revenue > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label={anyContact ? "Unclaimed contacts" : "Contacts captured"}
          value={anyContact ? unclaimed.length : 0}
          qualifier={
            anyContact
              ? unclaimed.length
                ? "not yet clients"
                : "all handled"
              : `across ${scoped.length.toLocaleString()} doors`
          }
          tone={anyContact && unclaimed.length ? "attention" : "neutral"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* The gap worth naming: doors closed with no way to reach anyone again. */}
      {!anyContact && closedCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--crm-attention-bg)] bg-[var(--crm-surface)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--crm-attention)]" />
          <p className="text-sm text-[var(--crm-text-dim)]">
            <span className="font-medium text-[var(--crm-text)]">
              No door has a name or a number on it.
            </span>{" "}
            {closedCount} doors have been pitched or closed, but none captured contact
            details — so none of them became a client, and there is no way to follow up
            or rebook any of them. Capturing a name and phone at the door is the missing
            link between this map and the CRM.
          </p>
        </div>
      )}

      <CountTabs
        items={[
          { label: "All", count: scoped.length, href: qs({ state: null }), active: !activeState },
          ...ORDER.map((s) => ({
            label: DOOR_STATE_LABEL[s],
            count: counts[s],
            href: qs({ state: s }),
            active: activeState === s,
          })),
        ]}
      />

      {/* Unclaimed contacts get their own tray — this is the work, not a feed. */}
      {unclaimed.length > 0 && !activeState && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--crm-attention)]">
            Contacts never turned into clients
          </h3>
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-attention-bg)] bg-[var(--crm-surface)]">
            {unclaimed.slice(0, 8).map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {d.contact_name || d.contact_phone}
                  </div>
                  <div className="truncate text-xs text-[var(--crm-text-faint)]">
                    {territoryName.get(d.territory_id) ?? "Unknown territory"}
                    {d.contact_phone && d.contact_name ? ` · ${d.contact_phone}` : ""}
                    {d.contact_address ? ` · ${d.contact_address}` : ""}
                  </div>
                </div>
                {has("quote.create") && (
                  <Link
                    href={`/crm/quotes/new?name=${encodeURIComponent(d.contact_name ?? "")}&phone=${encodeURIComponent(d.contact_phone ?? "")}&address=${encodeURIComponent(d.contact_address ?? "")}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--crm-accent-line)] bg-[var(--crm-accent-weak)] px-2.5 py-1.5 text-xs font-medium text-[var(--crm-accent)] transition-colors hover:bg-[var(--crm-accent)] hover:text-white"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Quote
                  </Link>
                )}
              </div>
            ))}
            {unclaimed.length > 8 && (
              <div className="px-4 py-2 text-xs text-[var(--crm-text-faint)]">
                + {unclaimed.length - 8} more
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
          {activeState ? DOOR_STATE_LABEL[activeState] : "All doors"}
        </h3>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-10 text-center">
            <DoorOpen className="mx-auto h-6 w-6 text-[var(--crm-text-faint)]" />
            <p className="mt-2 text-sm text-[var(--crm-text-dim)]">Nothing here yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)]">
            {visible.slice(0, 60).map((d) => {
              const state = doorState(d)
              const visits = d.visits ?? []
              const last = visits[visits.length - 1]
              const rev = visits.reduce((s, v) => s + (v.revenue ?? 0), 0)
              // Every visit carries date + time; contact fields are empty on all
              // 325 rows. So the knock itself is the row's identity, and the note
              // ("Windows") is the headline when the rep left one.
              const headline =
                d.contact_name ||
                (last?.notes && last.notes.trim()) ||
                (last?.date ? formatKnockDate(last.date, last.time) : "Door")

              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{headline}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_TONE[state]}`}
                      >
                        {DOOR_STATE_LABEL[state]}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                      {territoryName.get(d.territory_id) ?? "Unknown territory"}
                      {headline !== formatKnockDate(last?.date ?? "", last?.time) && last?.date
                        ? ` · ${formatKnockDate(last.date, last.time)}`
                        : ""}
                      {d.total_visits > 1 ? ` · ${d.total_visits} visits` : ""}
                      {d.contact_phone ? ` · ${d.contact_phone}` : ""}
                    </div>
                  </div>

                  {rev > 0 && (
                    <span className="crm-numeral shrink-0 text-sm text-[var(--crm-accent)]">
                      ${rev.toLocaleString()}
                    </span>
                  )}

                  {d.crm_client_id && (
                    <Link
                      href={`/crm/clients/${d.crm_client_id}`}
                      className="shrink-0 text-xs text-[var(--crm-accent)] hover:underline"
                    >
                      Client
                    </Link>
                  )}
                </div>
              )
            })}
            {visible.length > 60 && (
              <div className="px-4 py-2 text-xs text-[var(--crm-text-faint)]">
                Showing 60 of {visible.length.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
