import type { Metadata } from 'next'

import { BRAND } from '@/lib/constants/brand'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms governing use of ${BRAND.fullName}.`,
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
