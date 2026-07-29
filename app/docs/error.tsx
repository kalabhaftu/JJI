'use client'

import { SegmentError } from '@/components/segment-error'

export default function DocsError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <SegmentError {...props} surface="docs" />
}
