'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  BookOpen01Icon,
  BrainCircuitIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  ChartLineData01Icon,
  ChevronRightIcon,
  File01Icon,
  Moon01Icon,
  PencilEdit01Icon,
  SmartPhone01Icon,
  Sun01Icon,
  Target01Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { BRAND } from '@/lib/constants/brand'

const features = [
  {
    icon: PencilEdit01Icon,
    title: 'Journal the decision',
    description: 'Capture the setup, context, execution, and lesson while the trade is still fresh.',
  },
  {
    icon: ChartColumnIcon,
    title: 'See the pattern',
    description: 'Move beyond win rate with equity, drawdown, expectancy, and setup-level performance.',
  },
  {
    icon: Upload01Icon,
    title: 'Bring your history',
    description: 'Import supported broker exports and keep your existing trading record in one place.',
  },
  {
    icon: BrainCircuitIcon,
    title: 'Review with AI',
    description: 'Ask focused questions about your journal and receive analysis grounded in your own data.',
  },
  {
    icon: Target01Icon,
    title: 'Track the rules',
    description: 'Keep prop-firm phases, drawdown limits, goals, and daily discipline visible.',
  },
  {
    icon: SmartPhone01Icon,
    title: 'Stay close to the work',
    description: 'Log, review, and adjust from the screen you already have with you.',
  },
] as const

const workflow = [
  ['01', 'Capture', 'Log what happened, what you saw, and what you felt.'],
  ['02', 'Connect', 'Link trades to setups, tags, accounts, and sessions.'],
  ['03', 'Adjust', 'Use the review to make one practical change for the next session.'],
] as const

export default function HomePage() {
  const { theme, toggleTheme } = useTheme()
  const { docsHref, demoHref, mainAppHref, mainAppLaunchHref } = usePublicSurfaceRouting()
  const primaryHref = mainAppLaunchHref('/dashboard')

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href={mainAppHref('/')} className="flex min-w-0 items-center gap-3 [@media(pointer:coarse)]:min-h-11" aria-label="JJI home">
            <Logo className="h-8 w-8 shrink-0" />
            <div className="min-w-0 leading-none">
              <span className="block text-sm font-black tracking-tight text-foreground">{BRAND.name}</span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                {BRAND.fullName}
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link href="#features" className="transition-colors hover:text-foreground">Features</Link>
            <Link href="#workflow" className="transition-colors hover:text-foreground">How it works</Link>
            <Link href={docsHref()} className="transition-colors hover:text-foreground">Docs</Link>
            <Link href={mainAppHref('/contact')} className="transition-colors hover:text-foreground">Contact</Link>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="tertiary" size="icon" className="h-9 w-9" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? (
                <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
              ) : (
                <HugeiconsIcon icon={Moon01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
              )}
            </Button>
            <Button asChild size="sm" className="rounded-xl px-4">
              <Link href={primaryHref}>Open JJI</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content">
        <section className="relative isolate overflow-hidden">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8">
            <div className="max-w-2xl">
              <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-7xl">
                Journal the trade. Find the edge.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {BRAND.fullName} gives you one calm workspace for execution, journaling, analytics, and review so every session leaves you with a clearer next decision.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 rounded-xl px-6">
                  <Link href={primaryHref}>
                    Open your workspace
                    <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="h-12 rounded-xl px-6">
                  <Link href={demoHref()}>Preview the workspace</Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-3 shadow-xl shadow-black/5 sm:p-4">
                <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                  <div className="flex items-center justify-between pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground">
                        <HugeiconsIcon icon={ChartLineData01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
                      </div>
                      <div><p className="text-sm font-semibold">Trading overview</p><p className="text-[11px] text-muted-foreground">This week, all accounts</p></div>
                    </div>
                    <span className="rounded-lg border border-border/70 px-2 py-1 text-xs text-muted-foreground">Example workspace</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
                    {[
                      ['Net P&L', '+$2,480', 'text-foreground'],
                      ['Win rate', '64.2%', 'text-foreground'],
                      ['Expectancy', '$148', 'text-foreground'],
                      ['Drawdown', '-2.8%', 'text-foreground'],
                    ].map(([label, value, color]) => (
                      <div key={label} className="rounded-xl border border-border bg-card p-3">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                        <p className={`mt-2 text-lg font-semibold tracking-tight ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold">Equity curve</p><p className="text-[10px] text-muted-foreground">Last 20 sessions</p></div>
                    <div className="relative h-36 overflow-hidden rounded-lg bg-muted/30">
                      <svg viewBox="0 0 640 170" className="h-full w-full" role="img" aria-label="Illustration of an upward equity curve" preserveAspectRatio="none">
                        <path d="M0 143 C44 136 58 151 92 128 S140 132 170 109 S218 116 248 91 S294 102 324 78 S370 93 400 59 S448 73 478 48 S529 61 556 27 S607 42 640 12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-foreground" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <HugeiconsIcon icon={CalendarDaysIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" /> Review rhythm
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">3 sessions reviewed this week</p>
                      <div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-foreground" /></div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <HugeiconsIcon icon={BookOpen01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" /> Journal streak
                      </div>
                      <p className="mt-3 text-2xl font-semibold">12 days</p>
                      <p className="text-[11px] text-muted-foreground">Keep the process visible.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">The workspace</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Everything around the trade, in one place.</h2><p className="mt-4 text-muted-foreground">JJI keeps the operational work close to the reflection that makes it useful.</p></div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon, title, description }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6 sm:p-7">
                  <HugeiconsIcon icon={icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
                  <h3 className="mt-6 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">A repeatable process</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">The goal is not more data. It is better decisions.</h2>
            <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">Build a review habit that connects your execution to the outcomes. Keep the process simple enough to use after every session.</p>
            <Button asChild variant="secondary" className="mt-7 rounded-xl">
              <Link href={docsHref('/docs/getting-started')}>
                Read the quick start <HugeiconsIcon icon={ArrowUpRight01Icon} className="ml-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {workflow.map(([number, title, description]) => (
              <div key={number} className="flex gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <span className="text-xs font-bold tracking-[0.16em] text-muted-foreground">{number}</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
                <HugeiconsIcon icon={ChevronRightIcon} className="ml-auto mt-1 hidden h-4 w-4 text-muted-foreground sm:block" strokeWidth={1.5} color="currentColor" />
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <HugeiconsIcon icon={File01Icon} className="h-6 w-6 text-primary" strokeWidth={1.5} color="currentColor" />
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Make the next session easier to review.</h2>
          <p className="mt-4 max-w-xl text-muted-foreground">Start with the web workspace, then keep your journal close with the JJI mobile app.</p>
          <Button asChild size="lg" className="mt-8 h-12 rounded-xl px-7">
            <Link href={primaryHref}>
              Open JJI <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />
            </Link>
          </Button>
        </section>

      </main>
    </div>
  )
}
