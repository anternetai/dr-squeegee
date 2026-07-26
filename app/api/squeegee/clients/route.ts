import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Create a client. The New Client screen used to insert straight from the
// browser with the anon key, which is what kept squeegee_clients open to anon
// in RLS. Explicit field list — never spread the request body into .insert().
export async function POST(request: NextRequest) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const name = typeof body.name === "string" ? body.name.trim() : ""

  if (!name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 })
  }

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from("squeegee_clients")
    .insert({
      name,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
