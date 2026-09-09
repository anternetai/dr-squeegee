import { permanentRedirect } from "next/navigation"

// The Command Center folded into the Dashboard on 2026-09-08 (CRM v3): the
// assign-crew and remind controls live next to each job on /crm now. The route
// stays because it is in browser history, on a home-screen shortcut, and in
// old Slack messages.
export default function OpsPage() {
  permanentRedirect("/crm")
}
