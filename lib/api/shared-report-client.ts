import { apiRequest } from '@/lib/api/client'

export interface SharedReportViewResult {
  viewCount: number
  counted: boolean
}

export function recordSharedReportView(
  slug: string,
  signal?: AbortSignal,
): Promise<SharedReportViewResult> {
  return apiRequest<SharedReportViewResult>(`/api/v1/reports/shared/${slug}/view`, {
    method: 'POST',
    cache: 'no-store',
    operation: 'record-shared-report-view',
    ...(signal ? { signal } : {}),
  }).then((response) => {
    if (!response.data) throw new Error('Missing view-count response')
    return response.data
  })
}
