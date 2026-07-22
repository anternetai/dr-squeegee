import { redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { CrewLoginForm } from "./crew-login-form"

export const dynamic = "force-dynamic"

export default async function CrewLoginPage() {
  const employee = await getSessionEmployee()
  if (employee) redirect("/team")
  return <CrewLoginForm />
}
