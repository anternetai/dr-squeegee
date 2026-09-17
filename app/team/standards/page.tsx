import { redirect } from "next/navigation"
import { Check } from "lucide-react"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { MISSION, VALUES, EXPECTATIONS } from "@/lib/squeegee/company"

export const dynamic = "force-dynamic"

export default async function StandardsPage() {
  const employee = await getSessionEmployee()
  if (!employee) redirect("/team/login")

  return (
    <div className="mx-auto max-w-lg px-4 pb-4">
      <header className="py-5">
        <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">Standards</p>
        <h1 className="text-2xl font-bold">How we work</h1>
      </header>

      <section className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold mb-2">Our mission</p>
        <p className="text-lg leading-relaxed">{MISSION}</p>
      </section>

      <section className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold mb-3">Our values</p>
        <div className="space-y-4">
          {VALUES.map((v, i) => (
            <div key={v.title} className="flex gap-3">
              <span className="text-[#2D8C6F] font-bold text-lg shrink-0">{i + 1}</span>
              <div>
                <p className="font-semibold">{v.title}</p>
                <p className="text-sm text-gray-400">
                  {v.body}
                  {v.scripture && <span className="text-[#2D8C6F]"> — {v.scripture}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold mb-3">What&apos;s expected on every job</p>
        <ul className="space-y-2.5">
          {EXPECTATIONS.map((e) => (
            <li key={e} className="flex gap-3 text-sm text-gray-300">
              <Check className="h-4 w-4 text-[#2D8C6F] shrink-0 mt-0.5" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
