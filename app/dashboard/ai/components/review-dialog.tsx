import { Brain, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WeeklyReview } from '../types'

interface ReviewDialogProps {
  open: boolean
  review: WeeklyReview | null
  index: number | null
  total: number
  isSending: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (index: number) => void
  onDiscuss: (review: WeeklyReview) => void
}

export function ReviewDialog({ open, review, index, total, isSending, onOpenChange, onNavigate, onDiscuss }: ReviewDialogProps) {
  if (!review) return null
  const grade = review.grade || review.riskGrade || '—'
  const consistency = review.consistencyScore || review.stats?.consistencyScore || '—'
  const strengths = review.highlights || review.strengths || []
  const weaknesses = review.lowlights || review.weaknesses || []
  const recommendations = review.recommendations || (review.focusNextWeek ? [review.focusNextWeek] : [])
  const priority = review.topPriorityFix || review.stats?.topPriorityFix

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Weekly performance review</DialogTitle>
              <DialogDescription className="mt-1">{review.weekStart ? `Week of ${format(new Date(review.weekStart), 'MMMM d, yyyy')}` : 'Saved analysis'}</DialogDescription>
            </div>
            {total > 1 && index !== null && (
              <div className="flex items-center gap-1 rounded-xl border border-border p-1">
                <Button variant="ghost" size="icon" className="touch-target-compact h-8 w-8" disabled={index >= total - 1} onClick={() => onNavigate(index + 1)} aria-label="Older review"><ChevronLeft /></Button>
                <span className="min-w-12 text-center text-[11px] font-semibold text-muted-foreground">{index + 1} / {total}</span>
                <Button variant="ghost" size="icon" className="touch-target-compact h-8 w-8" disabled={index <= 0} onClick={() => onNavigate(index - 1)} aria-label="Newer review"><ChevronRight /></Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-7">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:w-80">
            <Metric label="Grade" value={grade} />
            <Metric label="Consistency" value={`${consistency}/10`} />
          </div>
          {review.summary && <ReviewSection title="Summary"><p className="text-sm leading-6 text-muted-foreground">{review.summary}</p></ReviewSection>}
          <div className="grid gap-6 sm:grid-cols-2">
            <ListSection title="Strengths" items={strengths} tone="success" />
            <ListSection title="Weaknesses" items={weaknesses} tone="destructive" />
          </div>
          <ListSection title="Recommended focus" items={recommendations} tone="warning" />
          <ListSection title="Performance evidence" items={review.performanceInsights || []} />
          <ListSection title="Emotional patterns" items={review.emotionalPatterns || []} />
          {priority && <div className="rounded-xl bg-destructive/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-destructive">Top priority</p><p className="mt-2 text-sm leading-6 text-foreground">{priority}</p></div>}
          <Button className="w-full" disabled={isSending} onClick={() => onDiscuss(review)}><Brain /> Discuss this review</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[hsl(var(--surface-raised))] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{value}</p></div>
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>{children}</section>
}

function ListSection({ title, items, tone }: { title: string; items: string[]; tone?: 'success' | 'destructive' | 'warning' }) {
  if (items.length === 0) return null
  const dot = tone === 'success' ? 'bg-success' : tone === 'destructive' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : 'bg-primary'
  return <ReviewSection title={title}><ul className="space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"><span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />{item}</li>)}</ul></ReviewSection>
}
