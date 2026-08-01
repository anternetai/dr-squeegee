import { redirect } from "next/navigation"

// Knocks moved under the Doors module at /crm/field/knocks when Doors folded
// into the CRM (2026-07-31). Kept as a redirect because this path is in
// Anthony's home-screen PWA shortcut and in older links.
export default function KnocksRedirect() {
  redirect("/crm/field/knocks")
}
