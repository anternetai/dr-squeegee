import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionMember } from '@/lib/squeegee/member-auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign In – Dr. Squeegee Care Club',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function PortalLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams

  // Already signed in → straight to the portal
  const member = await getSessionMember()
  if (member) {
    redirect(next ? `/portal/${next}` : '/portal')
  }

  return <LoginForm next={next ?? null} />
}
