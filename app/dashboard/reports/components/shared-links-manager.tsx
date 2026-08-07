'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Link2,
  Trash2,
  Copy,
  Check,
  Calendar,
  Eye,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiRequestData } from '@/lib/api/client'
import { reportClientError } from '@/lib/observability/report-error'

interface SharedReport {
  id: string
  slug: string
  title: string
  dateFrom: string | null
  dateTo: string | null
  viewCount: number
  isPublic: boolean
  expiresAt: string | null
  createdAt: string
}

export function SharedLinksManager() {
  const [reports, setReports] = useState<SharedReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    try {
      const data = await apiRequestData<{ reports?: SharedReport[] }>('/api/v1/reports/share', {
        method: 'GET',
        retry: { mode: 'safe' },
        operation: 'load-shared-report-links',
      })
      setReports(data.reports || [])
    } catch (error) {
      reportClientError(error, { operation: 'load-shared-report-links', route: '/api/v1/reports/share' })
      toast.error('Failed to load shared links.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleCopy = useCallback(async (slug: string) => {
    const url = `${window.location.origin}/reports/shared/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedSlug(slug)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch (error) {
      reportClientError(error, { operation: 'copy-shared-report-link', route: '/reports/shared' })
      toast.error('Could not copy link')
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      await apiRequestData<{ deleted: boolean }>(`/api/v1/reports/share?id=${id}`, {
        method: 'DELETE',
        retry: { mode: 'never' },
        operation: 'delete-shared-report-link',
      })
      toast.success('Shared report deleted successfully')
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      reportClientError(error, { operation: 'delete-shared-report-link', route: '/api/v1/reports/share' })
      toast.error('Failed to delete shared link')
    } finally {
      setDeletingId(null)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <div className="p-6 border-b border-border/10 shrink-0">
        <h2 className="text-lg font-black tracking-tighter uppercase">Manage Shared Links</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
          View or revoke public access to your trading statements
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground/35 mb-3" />
            <p className="text-xs font-semibold text-muted-foreground">No active shared links found</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[240px]">
              Generate shared links from the share dropdown menu to publish reports.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {reports.map((report) => {
              const isCopied = copiedSlug === report.slug
              const isExpired = report.expiresAt ? new Date(report.expiresAt) < new Date() : false
              const range = report.dateFrom && report.dateTo
                ? `${format(new Date(report.dateFrom), 'MMM d')} - ${format(new Date(report.dateTo), 'MMM d, yyyy')}`
                : 'All Time'

              return (
                <div key={report.id} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs truncate max-w-[200px] sm:max-w-[300px]">
                        {report.title}
                      </span>
                      {isExpired && (
                        <span className="text-[8px] bg-red-500/10 text-red-500 font-extrabold uppercase px-1.5 py-0.5 rounded-full">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 opacity-60" />
                        {range}
                      </span>
                      <span className="opacity-30">•</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3 opacity-60" />
                        {report.viewCount} views
                      </span>
                      {report.expiresAt && (
                        <>
                          <span className="opacity-30">•</span>
                          <span>Expires: {format(new Date(report.expiresAt), 'MMM d, yyyy')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="tertiary"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      onClick={() => handleCopy(report.slug)}
                      title="Copy public link"
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5 text-profit" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <a
                      href={`/reports/shared/${report.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="Visit link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      variant="tertiary"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-short hover:bg-short/10 hover:text-short/90"
                      onClick={() => handleDelete(report.id)}
                      disabled={deletingId === report.id}
                      title="Delete link"
                    >
                      {deletingId === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
