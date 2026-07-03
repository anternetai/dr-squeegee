import { createClient } from '@supabase/supabase-js'
import { Caveat } from 'next/font/google'
import type { Metadata } from 'next'
import { AgreementView } from './agreement-view'
import type { SqueegeePlan } from '@/lib/squeegee/plans'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-signature',
})

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
  title: 'Your Service Agreement – Dr. Squeegee',
  description:
    'Annual Exterior Care Plan agreement from Dr. Squeegee — House Calls for a Cleaner Home.',
  robots: { index: false, follow: false },
}

export default async function AgreementPage({ params }: PageProps) {
  const { token } = await params
  const supabase = getAdmin()

  const { data, error } = await supabase
    .from('squeegee_plans')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4"
        style={{ fontFamily: 'var(--font-brand-body), sans-serif' }}
      >
        <div className="text-center">
          <p className="text-4xl mb-4">&#128269;</p>
          <h1
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-brand-display), sans-serif' }}
          >
            Agreement Not Found
          </h1>
          <p className="text-white/50 text-sm">
            This link may have expired or the agreement does not exist.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={caveat.variable}>
      <AgreementView plan={data as SqueegeePlan} />
    </div>
  )
}
