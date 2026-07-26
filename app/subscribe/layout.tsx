import { AuthenticatedProviders } from '@/components/authenticated-providers'

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedProviders>{children}</AuthenticatedProviders>
}
