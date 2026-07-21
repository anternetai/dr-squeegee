#!/usr/bin/env node
// One-time backfill: create squeegee_clients rows for historical squeegee_jobs
// that predate the client_id FK (pre-7/17 quote flows inserted jobs directly
// without ever creating/linking a client row).
//
// Dedupe key = normalized phone (digits only, leading US "1" stripped so
// "17045551234" and "7045551234" collapse to the same person). Within a
// dedupe group, the EARLIEST job (by created_at) is the source of truth for
// the new client's name/email/address; every job in the group links to that
// one client.
//
// SAFE BY DEFAULT: dry run only. Prints exact counts and the planned
// inserts/links, touches nothing. Pass --apply to actually write — do not
// pass --apply until a human has reviewed the printed plan.
//
// Usage:
//   node scripts/backfill-clients-from-jobs.mjs            # dry run (default)
//   node scripts/backfill-clients-from-jobs.mjs --apply     # actually writes

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

// --- minimal .env.local loader (no extra dependency) ---
function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url)
  let text
  try {
    text = readFileSync(path, "utf8")
  } catch {
    console.error("Could not read .env.local at", path.pathname)
    process.exit(1)
  }
  const env = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function normalizePhone(raw) {
  if (!raw) return ""
  const digits = String(raw).replace(/\D/g, "")
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1)
  return digits
}

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }
  const supabase = createClient(url, key)

  console.log(APPLY ? "*** APPLY MODE — this will write to the database ***" : "DRY RUN — no writes will be made")
  console.log("")

  const { data: jobs, error: jobsErr } = await supabase
    .from("squeegee_jobs")
    .select("id, client_name, client_phone, client_email, address, created_at, client_id")
    .is("client_id", null)
    .order("created_at", { ascending: true })

  if (jobsErr) {
    console.error("Failed to fetch jobs:", jobsErr.message)
    process.exit(1)
  }

  const { data: clients, error: clientsErr } = await supabase
    .from("squeegee_clients")
    .select("id, name, phone, email, address")

  if (clientsErr) {
    console.error("Failed to fetch clients:", clientsErr.message)
    process.exit(1)
  }

  const clientByNormPhone = new Map()
  for (const c of clients ?? []) {
    const n = normalizePhone(c.phone)
    if (n) clientByNormPhone.set(n, c)
  }

  const totalMissing = (jobs ?? []).length
  const noPhone = []
  const groups = new Map() // normPhone -> jobs[]

  for (const j of jobs ?? []) {
    const n = normalizePhone(j.client_phone)
    if (!n) {
      noPhone.push(j)
      continue
    }
    if (!groups.has(n)) groups.set(n, [])
    groups.get(n).push(j)
  }

  let newClientsPlanned = 0
  let jobsLinkingToNewClient = 0
  let jobsLinkingToExistingClient = 0
  const plan = []

  for (const [normPhone, groupJobs] of groups.entries()) {
    const existing = clientByNormPhone.get(normPhone)
    const earliest = groupJobs[0] // already sorted by created_at asc from the query
    if (existing) {
      jobsLinkingToExistingClient += groupJobs.length
      plan.push({
        norm_phone: normPhone,
        action: "link_existing",
        client_id: existing.id,
        client_name: existing.name,
        job_ids: groupJobs.map((j) => j.id),
      })
    } else {
      newClientsPlanned += 1
      jobsLinkingToNewClient += groupJobs.length
      plan.push({
        norm_phone: normPhone,
        action: "create_and_link",
        source_job_id: earliest.id,
        client_name: earliest.client_name,
        client_phone: earliest.client_phone,
        client_email: earliest.client_email,
        client_address: earliest.address,
        job_ids: groupJobs.map((j) => j.id),
      })
    }
  }

  console.log("=== BACKFILL DRY-RUN REPORT ===")
  console.log(`Jobs missing client_id:              ${totalMissing}`)
  console.log(`  - with no usable phone (skipped):  ${noPhone.length}`)
  console.log(`  - with a usable phone:              ${totalMissing - noPhone.length}`)
  console.log(`Unique normalized phones (groups):    ${groups.size}`)
  console.log(`Clients that would be CREATED:        ${newClientsPlanned}`)
  console.log(`Jobs that would link to a NEW client: ${jobsLinkingToNewClient}`)
  console.log(`Jobs that would link to an EXISTING client: ${jobsLinkingToExistingClient}`)
  console.log("")

  if (noPhone.length > 0) {
    console.log("Jobs with no usable phone (need manual review — not touched by this script):")
    for (const j of noPhone) {
      console.log(`  - ${j.id}  ${j.client_name}  "${j.client_phone ?? ""}"  created ${j.created_at}`)
    }
    console.log("")
  }

  console.log("Planned actions:")
  for (const p of plan) {
    if (p.action === "create_and_link") {
      console.log(
        `  CREATE client "${p.client_name}" (${p.client_phone}) from job ${p.source_job_id} -> link ${p.job_ids.length} job(s): ${p.job_ids.join(", ")}`
      )
    } else {
      console.log(
        `  LINK ${p.job_ids.length} job(s) to EXISTING client ${p.client_id} (${p.client_name}): ${p.job_ids.join(", ")}`
      )
    }
  }

  if (!APPLY) {
    console.log("")
    console.log("Dry run complete. No changes were made. Re-run with --apply to execute this plan.")
    return
  }

  // --- APPLY ---
  console.log("")
  console.log("Applying plan...")
  let created = 0
  let linked = 0
  for (const p of plan) {
    let clientId = p.client_id
    if (p.action === "create_and_link") {
      const { data: newClient, error: insertErr } = await supabase
        .from("squeegee_clients")
        .insert({
          name: p.client_name,
          phone: p.client_phone ?? null,
          email: p.client_email ?? null,
          address: p.client_address ?? null,
        })
        .select("id")
        .single()
      if (insertErr) {
        console.error(`  FAILED to create client for phone ${p.norm_phone}:`, insertErr.message)
        continue
      }
      clientId = newClient.id
      created += 1
    }
    const { error: updateErr } = await supabase
      .from("squeegee_jobs")
      .update({ client_id: clientId })
      .in("id", p.job_ids)
    if (updateErr) {
      console.error(`  FAILED to link jobs [${p.job_ids.join(", ")}]:`, updateErr.message)
      continue
    }
    linked += p.job_ids.length
  }
  console.log(`Done. Created ${created} client(s), linked ${linked} job(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
