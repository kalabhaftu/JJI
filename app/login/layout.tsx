import { AuthenticatedProviders } from '@/components/authenticated-providers'
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedProviders>{children}</AuthenticatedProviders>
}
