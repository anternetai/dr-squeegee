import type { SupabaseClient } from "@supabase/supabase-js"

/* ---------------------------------------------------------------------------
   Door → CRM linkage
   ---------------------------------------------------------------------------
   One implementation, two callers:
     - in-process, from the CRM's own field module (app/api/crm/field/doors)
     - over HTTP, from the standalone `doors` repo (api/squeegee/from-door-knock)

   This is the `field.knock` → `client.record` capability seam. Before the merge
   it only existed on the HTTP path, and it never fired: contact capture was
   marked "(optional)" in the door overlay, so all 325 live doors carry a null
   name/phone and the bridge's own `if (!hasContact) return null` short-circuit
   meant not one door ever became a client. $2,725 of closes with no customer.
--------------------------------------------------------------------------- */

export interface LinkDoorInput {
  contactName?: string | null
  contactPhone?: string | null
  contactAddress?: string | null
  territoryName: string
  doorId: string
  closed: boolean
  revenue?: number | null
  notes?: string | null
}

export interface LinkDoorResult {
  client_id: string
  job_id: string | null
}

export class NoContactError extends Error {
  constructor() {
    super("A name or phone number is required to link a door to the CRM")
    this.name = "NoContactError"
  }
}

export async function linkDoorToCrm(
  supabase: SupabaseClient,
  input: LinkDoorInput
): Promise<LinkDoorResult> {
  const name = input.contactName?.trim()
  const cleanPhone = input.contactPhone?.replace(/\D/g, "") || null

  if (!name && !cleanPhone) throw new NoContactError()

  const displayName = name || "Door knock contact"
  const address = input.contactAddress?.trim() || null

  // 1. Upsert the client — match on phone, which is the only reliable key a
  //    door knock produces. Name-only contacts always create a new row.
  let client_id: string | null = null

  if (cleanPhone) {
    const { data: existing } = await supabase
      .from("squeegee_clients")
      .select("id")
      .eq("phone", cleanPhone)
      .maybeSingle()
    if (existing) client_id = existing.id as string
  }

  if (!client_id) {
    const { data: newClient, error } = await supabase
      .from("squeegee_clients")
      .insert({
        name: displayName,
        phone: cleanPhone,
        email: null,
        address,
        notes: `From door knock — ${input.territoryName} (door ${input.doorId})`,
      })
      .select("id")
      .single()
    if (error) throw new Error(`client insert failed: ${error.message}`)
    client_id = newClient.id as string
  }

  // 2. On a close the deal already happened in person — there is no quote to
  //    send, so the job starts at "approved" (price known, ready to schedule)
  //    rather than "new".
  let job_id: string | null = null

  if (input.closed) {
    const { data: job, error } = await supabase
      .from("squeegee_jobs")
      .insert({
        client_id,
        client_name: displayName,
        client_phone: cleanPhone,
        client_email: null,
        address: address || "Address not captured — see door knock notes",
        service_type: `Door-to-door — ${input.territoryName}`,
        status: "approved",
        price: input.revenue != null ? Number(input.revenue) : null,
        notes: [
          `Closed via door knock in ${input.territoryName} (door ${input.doorId}).`,
          input.notes?.trim(),
        ]
          .filter(Boolean)
          .join(" "),
      })
      .select("id")
      .single()

    if (error) {
      // The client landed; report that rather than losing it to a job failure.
      console.error("linkDoorToCrm job insert error:", error)
      return { client_id, job_id: null }
    }

    job_id = job.id as string

    await supabase.from("squeegee_activity").insert({
      job_id,
      type: "door_knock_close",
      note: `Created from a door knock close in ${input.territoryName}${
        input.revenue ? ` — $${Number(input.revenue).toFixed(2)}` : ""
      }.`,
    })
  }

  return { client_id, job_id }
}
