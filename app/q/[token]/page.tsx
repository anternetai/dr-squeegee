import { createClient } from '@supabase/supabase-js'
import { QuoteView } from './quote-view'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ token: string }>
}

interface QuoteService {
  name: string
  price: number
  description?: string
}

export interface SqueegeeQuote {
  id: string
  token: string
  job_id: string | null
  client_name: string
  client_phone: string | null
  client_email: string | null
  address: string
  services: QuoteService[]
  subtotal: number | null
  discount_type: 'percent' | 'dollar' | null
  discount_value: number | null
  total_price: number
  status: 'pending' | 'accepted' | 'declined' | 'help'
  client_response_at: string | null
  created_at: string
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const ogImageUrl = `https://www.drsqueegeeclt.com/q/${token}/opengraph-image`

  return {
    metadataBase: new URL('https://www.drsqueegeeclt.com'),
    title: 'Your Quote – Dr. Squeegee',
    description: 'Professional house washing service quote from Dr. Squeegee — House Calls for a Cleaner Home.',
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    openGraph: {
      title: 'Dr. Squeegee — Your Service Quote',
      description: 'House Calls for a Cleaner Home. Professional pressure washing in Charlotte, NC.',
      siteName: 'Dr. Squeegee',
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Dr. Squeegee — Your Service Quote' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Dr. Squeegee — Your Service Quote',
      description: 'House Calls for a Cleaner Home. Professional pressure washing in Charlotte, NC.',
      images: [ogImageUrl],
    },
  }
}

export default async function QuotePage({ params }: PageProps) {
  const { token } = await params
  const supabase = getAdmin()

  const { data, error } = await supabase
    .from('squeegee_quotes')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFCF7] p-4" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
        <div className="text-center">
          <p className="text-4xl mb-4">&#128269;</p>
          <h1 className="text-xl font-bold text-[#2B2B2B] mb-2" style={{ fontFamily: "var(--font-brand-display), serif" }}>Quote Not Found</h1>
          <p className="text-[#2B2B2B]/50 text-sm">
            This link may have expired or the quote does not exist.
          </p>
        </div>
      </div>
    )
  }

  return <QuoteView quote={data as SqueegeeQuote} />
}
