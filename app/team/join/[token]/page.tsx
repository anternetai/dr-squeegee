import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { CrewOnboarding } from "./crew-onboarding"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function CrewJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { data: emp } = await getAdmin()
    .from("squeegee_employees")
    .select("name, phone, email, role, address, emergency_contact_name, emergency_contact_phone, availability, onboarded_at")
    .eq("invite_token", token)
    .single()

  if (!emp) {
    return (
      <Centered>
        <p className="text-lg font-semibold">This invite link is invalid or expired.</p>
        <p className="text-sm text-gray-400 mt-2">Ask Anthony to send you a fresh setup link.</p>
      </Centered>
    )
  }

  if (emp.onboarded_at) {
    return (
      <Centered>
        <p className="text-lg font-semibold">You&apos;re already set up, {emp.name.split(" ")[0]}.</p>
        <Link href="/team/login" className="inline-block mt-4 rounded-xl bg-[#2D8C6F] px-5 py-2.5 font-semibold text-white hover:bg-[#1F6B54]">
          Log in
        </Link>
      </Centered>
    )
  }

  return (
    <CrewOnboarding
      token={token}
      prefill={{
        name: emp.name,
        phone: emp.phone ?? "",
        email: emp.email ?? "",
        address: emp.address ?? "",
        emergency_contact_name: emp.emergency_contact_name ?? "",
        emergency_contact_phone: emp.emergency_contact_phone ?? "",
        availability: (emp.availability as Record<string, boolean>) ?? {},
      }}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">{children}</div>
}
