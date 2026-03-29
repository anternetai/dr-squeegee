import { cookies } from "next/headers"
import { verifyCrmCookieSignature } from "./crm-auth"

export async function verifyCrmAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get("crm_auth")
  if (!cookie?.value) return false
  return verifyCrmCookieSignature(cookie.value)
}
