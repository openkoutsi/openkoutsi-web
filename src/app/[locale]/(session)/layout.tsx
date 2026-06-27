import { SessionProviders } from './providers'

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProviders>{children}</SessionProviders>
}
