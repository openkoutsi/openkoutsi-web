import { redirect } from 'next/navigation'
import { getApiUrl } from '@/lib/api'

type Props = { params: Promise<{ locale: string }> }

// The marketing landing page moved to a standalone static site at koutsi.dev
// (openkoutsi/openkoutsi-landing-page). The web app now lives at app.koutsi.dev,
// so its root just routes users into the app: to first-run setup when the
// instance has no admin yet, otherwise to the login page.
export default async function RootPage({ params }: Props) {
  const { locale } = await params
  const apiUrl = getApiUrl()

  let needsSetup = false
  try {
    const res = await fetch(`${apiUrl}/api/setup/status`, { cache: 'no-store' })
    const data = await res.json()
    needsSetup = Boolean(data?.needs_setup)
  } catch {
    // Backend unreachable — fall through to the login page.
  }

  redirect(`/${locale}/${needsSetup ? 'setup' : 'login'}`)
}
