import { permanentRedirect } from "next/navigation"

export default function Home() {
  permanentRedirect("/get-quote")
}
