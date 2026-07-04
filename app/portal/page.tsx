import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PortalView, type PortalMember } from './[token]/portal-view'
import { getSessionMember } from '@/lib/squeegee/member-auth'
import type { PlanVisit, SqueegeePlan } from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const metadata: Metadata = {
  title: 'Care Club – Dr. Squeegee',
  robots: { index: false, follow: false },
}

// Session-based portal home — where "drsqueegeeclt.com/portal" lands.
export default async function PortalHome() {
  const member = await getSessionMember()
  if (!member) redirect('/portal/login')

  const supabase = getAdmin()
  const { data: plan } = await supabase
    .from('squeegee_plans')
    .select('*')
    .eq('id', member.plan_id)
    .single()

  if (!plan) redirect('/portal/login')

  const { data: visits } = await supabase
    .from('squeegee_plan_visits')
    .select('*')
    .eq('plan_id', plan.id)
    .order('scheduled_date', { ascending: true })

  return (
    <PortalView
      plan={plan as SqueegeePlan}
      initialVisits={(visits ?? []) as PlanVisit[]}
      member={member as unknown as PortalMember}
    />
  )
}
