import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { PortalView } from './portal-view'
import type { PlanVisit, SqueegeePlan } from '@/lib/squeegee/plans'

interface PageProps {
  params: Promise<{ token: string }>
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const metadata: Metadata = {
  title: 'Member Portal – Dr. Squeegee',
  description: 'Your Dr. Squeegee Annual Exterior Care Plan — visits, schedule, and more.',
  robots: { index: false, follow: false },
}

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params
  const supabase = getAdmin()

  const { data: plan, error } = await supabase
    .from('squeegee_plans')
    .select('*')
    .eq('portal_token', token)
    .single()

  if (error || !plan) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4"
        style={{ fontFamily: 'var(--font-brand-body), sans-serif' }}
      >
        <div className="text-center">
          <p className="text-4xl mb-4">&#128274;</p>
          <h1
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-brand-display), sans-serif' }}
          >
            Portal Not Found
          </h1>
          <p className="text-white/50 text-sm">
            This link doesn&apos;t look right. Check the link we texted you, or give us a call.
          </p>
        </div>
      </div>
    )
  }

  const { data: visits } = await supabase
    .from('squeegee_plan_visits')
    .select('*')
    .eq('plan_id', plan.id)
    .order('scheduled_date', { ascending: true })

  return <PortalView plan={plan as SqueegeePlan} initialVisits={(visits ?? []) as PlanVisit[]} />
}
