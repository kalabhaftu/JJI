import { Button } from '@/components/ui/button'
import type { TourId } from '@/lib/tours/types'
import { HugeiconsIcon } from '@hugeicons/react'
import { BookOpen01Icon, Briefcase01Icon, CalendarDaysIcon, DatabaseIcon, FlaskConicalIcon, LayoutGridIcon, ListStartIcon, Message01Icon, Setting06Icon, Target01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'

const TOUR_CARDS: Array<{ id: Exclude<TourId, 'onboarding' | 'dashboard' | 'analytics'>; title: string; description: string;   icon: import('@hugeicons/react').HugeiconsIconProps['icon'] }> = [
  { id: 'overview', title: 'Overview', description: 'Daily performance, account filters, widgets, and quick actions.', icon: LayoutGridIcon },
  { id: 'accounts', title: 'Accounts and import', description: 'Create portfolios and bring in broker or CSV history.', icon: Briefcase01Icon },
  { id: 'trades', title: 'Trades', description: 'Review the ledger and inspect individual execution details.', icon: ListStartIcon },
  { id: 'journal', title: 'Journal', description: 'Review decisions and patterns by trading day.', icon: CalendarDaysIcon },
  { id: 'reports', title: 'Reports', description: 'Compare performance, risk, sessions, and detailed evidence.', icon: ArrowUp01Icon },
  { id: 'playbook', title: 'Playbook', description: 'Connect models and rules to the trades they describe.', icon: BookOpen01Icon },
  { id: 'backtesting', title: 'Backtesting', description: 'Test rule sets against historical data.', icon: FlaskConicalIcon },
  { id: 'goals', title: 'Goals', description: 'Set and track measurable review targets.', icon: Target01Icon },
  { id: 'assistant', title: 'Assistant', description: 'Ask questions against selected workspace evidence.', icon: Message01Icon },
  { id: 'data', title: 'Data', description: 'Export and manage stored workspace data.', icon: DatabaseIcon },
  { id: 'settings', title: 'Settings', description: 'Manage preferences, connections, security, and help.', icon: Setting06Icon },
]

export function SettingsHelpSection({ startTour }: { startTour: (tourId: TourId) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-heading-text">Help and tours</h2>
        <p className="text-sm text-muted-foreground">Restart any section walkthrough. Completed steps stay completed when you resume.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TOUR_CARDS.map(({ id, title, description, icon: Icon }) => (
          <div key={id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <HugeiconsIcon icon={Icon} className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} color="currentColor" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => startTour(id)}>Start</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
