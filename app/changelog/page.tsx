import PublicLayout from '@/components/layouts/public-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { HugeiconsIcon } from '@hugeicons/react'
import { RocketIcon, SparklesIcon, Bug01Icon, Wrench01Icon } from '@hugeicons/core-free-icons'

const changelog = [
  {
    version: '2.0.0',
    date: '2026-03-26',
    highlights: [
      { type: 'feature', text: 'Full V1 API consolidation - all legacy routes removed' },
      { type: 'feature', text: 'Dynamic widget dashboard with 20+ customizable widgets' },
      { type: 'feature', text: 'Lexical rich-text journaling engine' },
      { type: 'feature', text: 'Prop firm multi-phase evaluation tracking with breach detection' },
      { type: 'feature', text: 'Async import jobs for timeout-safe large CSV processing' },
      { type: 'improvement', text: 'SSR prefetch for Reports page' },
      { type: 'improvement', text: 'Composite database indexes for high-frequency filters' },
      { type: 'fix', text: 'Lexical editor crash on empty root state (error #38)' },
      { type: 'fix', text: 'No-Trades modal false-positive detection' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-02-15',
    highlights: [
      { type: 'feature', text: 'Dashboard template system with create/clone/duplicate detection' },
      { type: 'feature', text: 'AI-powered CSV parsing for unrecognized broker formats' },
      { type: 'feature', text: 'Trading model / playbook system with performance tracking' },
      { type: 'improvement', text: 'Auto-adjust account date persistence' },
      { type: 'improvement', text: 'Browser dialogs replaced with ShadCN AlertDialog' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-01',
    highlights: [
      { type: 'feature', text: 'Initial release - trade import, journaling, accounts management' },
      { type: 'feature', text: 'Prop firm evaluation tracking (CFD focused)' },
      { type: 'feature', text: 'Dashboard with equity curve, drawdown, and calendar widgets' },
      { type: 'feature', text: 'Supabase authentication (Discord + Google OAuth)' },
    ],
  },
]

const typeIcon = { feature: SparklesIcon, improvement: Wrench01Icon, fix: Bug01Icon }
const typeColor = { feature: 'text-green-500', improvement: 'text-blue-500', fix: 'text-orange-500' }

export default function ChangelogPage() {
  return (
    <PublicLayout>
      <div className="space-y-8">
        <div className="space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <HugeiconsIcon icon={RocketIcon} className="h-8 w-8 text-primary" strokeWidth={1.5} color="currentColor" />
            Changelog
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Track what's new, improved, and fixed in JJI.</p>
        </div>

        <div className="space-y-6">
          {changelog.map((release) => (
            <Card key={release.version}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="text-sm font-bold px-3 py-1">v{release.version}</Badge>
                  <span className="text-sm text-muted-foreground">{release.date}</span>
                </div>
                <ul className="space-y-2">
                  {release.highlights.map((item, i) => {
                    const icon = typeIcon[item.type as keyof typeof typeIcon] || SparklesIcon
                    const color = typeColor[item.type as keyof typeof typeColor] || ''
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <HugeiconsIcon icon={icon} className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} strokeWidth={1.5} color="currentColor" />
                        <span className="text-sm">{item.text}</span>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
