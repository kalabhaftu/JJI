import { AuthenticatedProviders } from '@/components/authenticated-providers'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedProviders>{children}</AuthenticatedProviders>
}
