import { Button } from '@/components/ui/button'
import type { TourId } from '@/lib/tours/types'
import { LayoutGrid, Settings, Sparkles, TrendingUp } from 'lucide-react'

export function SettingsHelpSection({ startTour }: { startTour: (tourId: TourId) => void }) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Help</h2>
          <p className="text-xs text-muted-foreground/85">Restart interactive system tours to learn more about the platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Core Onboarding Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Take a quick walkthrough of the core platform layout, configure your timezone/theme in settings, and log a sample trade.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('onboarding')}
            >
              Start Onboarding Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Trading Dashboard Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Learn how to filter your data by specific trading accounts, customize and resize widgets on the dashboard canvas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('dashboard')}
            >
              Start Dashboard Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance Analytics Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Explore the reports view, analyze win-rates, profit factor metrics, trade duration stats, and weekly journal calendars.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('analytics')}
            >
              Start Analytics Tour
            </Button>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/45 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Settings & Customization Tour
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Understand how to modify preferences, toggle light/dark modes, add API credentials, and sync broker accounts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => startTour('settings')}
            >
              Start Settings Tour
            </Button>
          </div>
        </div>
      </div>
    )
  }
