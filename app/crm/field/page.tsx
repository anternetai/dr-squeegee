import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { MapPin, ChevronRight } from "lucide-react"
import { StatTile } from "@/components/squeegee/crm/stat-tile"
import { TerritoryMap } from "@/components/squeegee/field/territory-map"
import {
  computeKpis, doorState, type TerritoryDoor, type Territory,
} from "@/lib/crm/field/types"

export const dynamic = "force-dynamic"

// Service-role: the CRM is gated by the signed crm_auth cookie in middleware,
// not a Supabase session, so these queries carry no authenticated identity.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

function money(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`
}

export default async function FieldPage() {
  const supabase = getAdmin()

  const [{ data: territoryRows }, { data: doorRows }] = await Promise.all([
    supabase.from("territories").select("*").order("created_at", { ascending: false }),
    supabase.from("doors_territory_doors").select("*"),
  ])

  const territories = (territoryRows ?? []) as Territory[]
  const doors = (doorRows ?? []).map((d) => ({
    ...d,
    visits: Array.isArray(d.visits) ? d.visits : [],
  })) as TerritoryDoor[]

  const overall = computeKpis(doors)

  const byTerritory = new Map<string, TerritoryDoor[]>()
  for (const door of doors) {
    const list = byTerritory.get(door.territory_id)
    if (list) list.push(door)
    else byTerritory.set(door.territory_id, [door])
  }

  // Rank by revenue — the question this page answers is "where is the money",
  // not "what did I create most recently".
  const ranked = territories
    .map((t) => ({ territory: t, kpis: computeKpis(byTerritory.get(t.id) ?? []) }))
    .sort((a, b) => b.kpis.total_revenue - a.kpis.total_revenue)

  const mapped = doors.filter(
    (d) => typeof d.lat === "number" && typeof d.lng === "number"
  )
  const center: [number, number] = mapped.length
    ? [
        mapped.reduce((s, d) => s + d.lat, 0) / mapped.length,
        mapped.reduce((s, d) => s + d.lng, 0) / mapped.length,
      ]
    : [35.2271, -80.8431] // Charlotte

  const worked = doors.filter((d) => doorState(d) !== "unworked").length

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Field</h2>
          <p className="mt-0.5 text-sm text-[var(--crm-text-dim)]">
            {doors.length.toLocaleString()} doors across {territories.length} territories
            {overall.total_revenue > 0 && (
              <> · <span className="text-[var(--crm-accent)]">
                {money(overall.total_revenue)} closed at the door
              </span></>
            )}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Doors worked"
          value={worked.toLocaleString()}
          qualifier={`of ${doors.length.toLocaleString()}`}
        />
        <StatTile
          label="Contact rate"
          value={pct(overall.contact_rate)}
          qualifier={`${overall.doors_answered} answered`}
        />
        <StatTile
          label="Closed"
          value={overall.doors_closed}
          qualifier={overall.doors_pitched > 0 ? `${pct(overall.close_rate)} of pitches` : "no pitches yet"}
          tone={overall.doors_closed > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Revenue"
          value={money(overall.total_revenue)}
          qualifier={`${money(overall.avg_revenue_per_door)}/door`}
          tone={overall.total_revenue > 0 ? "accent" : "neutral"}
        />
      </div>

      {mapped.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--crm-line)]">
          <div className="h-[340px] w-full md:h-[420px]">
            <TerritoryMap center={center} zoom={13} doors={mapped} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--crm-line)] bg-[var(--crm-surface)] px-4 py-2.5 text-xs text-[var(--crm-text-dim)]">
            <Legend color="#2d8c6f" label="Pitched / closed" />
            <Legend color="#c8922f" label="Answered" />
            <Legend color="#b8453a" label="Not interested" />
            <Legend color="#5f6672" label="Not home" />
            <span className="ml-auto text-[var(--crm-text-faint)]">
              Ringed pins took more than one knock
            </span>
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
          Territories
        </h3>

        {ranked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-10 text-center">
            <MapPin className="mx-auto h-6 w-6 text-[var(--crm-text-faint)]" />
            <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
              No territories yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)]">
            {ranked.map(({ territory, kpis }) => (
              <Link
                key={territory.id}
                href={`/crm/field/knocks?territory=${encodeURIComponent(territory.id)}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--crm-surface-high)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{territory.name}</div>
                  <div className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                    {territory.address || `${kpis.total_doors} doors`}
                  </div>
                </div>

                <div className="hidden shrink-0 items-baseline gap-5 sm:flex">
                  <Metric label="doors" value={String(kpis.total_doors)} />
                  <Metric label="contact" value={pct(kpis.contact_rate)} />
                  <Metric label="closed" value={String(kpis.doors_closed)} />
                </div>

                <div className="w-20 shrink-0 text-right">
                  <span
                    className={
                      kpis.total_revenue > 0
                        ? "crm-numeral text-sm text-[var(--crm-accent)]"
                        : "crm-numeral text-sm text-[var(--crm-text-faint)]"
                    }
                  >
                    {money(kpis.total_revenue)}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--crm-text-faint)]" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-right">
      <span className="crm-numeral block text-sm leading-none">{value}</span>
      <span className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--crm-text-faint)]">
        {label}
      </span>
    </span>
  )
}
