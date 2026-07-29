'use client'

import { SegmentError } from '@/components/segment-error'

export default function ReportsError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <SegmentError {...props} surface="reports" />
}
