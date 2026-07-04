import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PortalView, type PortalMember } from './portal-view'
import { getSessionMember } from '@/lib/squeegee/member-auth'
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
  title: 'Care Club – Dr. Squeegee',
  description: 'Your Dr. Squeegee Care Club — visits, schedule, and more.',
  robots: { index: false, follow: false },
}

function NotFound() {
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

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params
  const supabase = getAdmin()

  // 1. Unguessable magic link
  let { data: plan } = await supabase
    .from('squeegee_plans')
    .select('*')
    .eq('portal_token', token)
    .maybeSingle()

  // 2. Vanity member slug (e.g. /portal/yvette) — memorable, so it requires
  //    being logged in as that member.
  if (!plan) {
    const { data: slugMember } = await supabase
      .from('squeegee_members')
      .select('id, plan_id')
      .eq('slug', token.toLowerCase())
      .maybeSingle()

    if (!slugMember) return <NotFound />

    const sessionMember = await getSessionMember()
    if (!sessionMember || sessionMember.id !== slugMember.id) {
      redirect(`/portal/login?next=${encodeURIComponent(token.toLowerCase())}`)
    }

    const { data: memberPlan } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('id', slugMember.plan_id)
      .single()
    if (!memberPlan) return <NotFound />
    plan = memberPlan
  }

  const [{ data: visits }, { data: member }] = await Promise.all([
    supabase
      .from('squeegee_plan_visits')
      .select('*')
      .eq('plan_id', plan.id)
      .order('scheduled_date', { ascending: true }),
    supabase
      .from('squeegee_members')
      .select('member_number, slug, email, created_at')
      .eq('plan_id', plan.id)
      .maybeSingle(),
  ])

  return (
    <PortalView
      plan={plan as SqueegeePlan}
      initialVisits={(visits ?? []) as PlanVisit[]}
      member={(member as PortalMember) ?? null}
    />
  )
}
