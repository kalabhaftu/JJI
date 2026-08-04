'use client'

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Fuse from 'fuse.js'
import {
  BookOpenText,
  Bot,
  CalendarDays,
  ChevronRight,
  Code,
  Download,
  FileText,
  FlaskConical,
  GanttChartSquare,
  Goal,
  List,
  NotebookPen,
  Rocket,
  Search,
  Smartphone,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { usePublicSurfaceRouting } from '@/hooks/use-public-surface-routing'
import { cn } from '@/lib/utils'
import { resolveNavigationPath } from '@/lib/navigation/registry'

type DocsNavItem = {
  title: string
  href: string
  description?: string
  keywords?: string[]
  subsections?: Array<{
    title: string
    href: string
  }>
}

type DocsNavSection = {
  title: string
  icon: typeof Rocket
  items: DocsNavItem[]
}

const docsNavigation: DocsNavSection[] = [
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [
      { title: 'Introduction', href: '/docs', description: 'Overview of JJI web and mobile' },
      { title: 'Quick Start Guide', href: '/docs/getting-started', description: 'Step-by-step setup tutorial' },
      { title: 'Application Flow', href: '/docs/features/app-flow', description: 'How pages, auth, and navigation connect' },
    ],
  },
  {
    title: 'Features',
    icon: BookOpenText,
    items: [
      { title: 'Trade Import', href: '/docs/features/importing', description: 'Import trades from brokers and files', keywords: ['csv', 'webhook', 'broker', 'sync', 'file upload', 'custom mapper', 'ninja trader', 'tradovate', 'rithmic', 'interactive brokers', 'webull', 'thor', 'match-trader', 'exness'] },
      { title: 'Dashboard', href: '/docs/features/dashboard', description: 'KPI cards, widgets, filters, templates', keywords: ['kpi', 'metrics', 'widgets', 'grid', 'templates'] },
      { title: 'Prop Firm Tracking', href: '/docs/features/prop-firm', description: 'Challenge lifecycle and phase management', keywords: ['evaluations', 'challenges', 'payouts', 'drawdown'] },
      { title: 'Journal & Notes', href: '/docs/features/journal', description: 'Daily journal, trade notes, screenshots', keywords: ['diary', 'images', 'upload', 'comments', 'ghost setups', 'missed trades'] },
      { title: 'Trade Table', href: '/docs/features/trade-table', description: 'Detailed trade record view and editing', keywords: ['edit', 'columns', 'filter', 'mae', 'mfe', 'replay'] },
      { title: 'Accounts', href: '/docs/features/accounts', description: 'Live and prop-firm account management', keywords: ['balance', 'equity', 'create account'] },
      { title: 'Playbook & Models', href: '/docs/features/playbook', description: 'Setup library and strategy rules', keywords: ['setups', 'strategies', 'ghost setups', 'grading'] },
      { title: 'Backtesting', href: '/docs/features/backtesting', description: 'Strategy simulation and review', keywords: ['simulation', 'paper trading'] },
      { title: 'AI Chat', href: '/docs/features/ai-chat', description: 'AI-powered performance analysis', keywords: ['grok', 'gpt-4o', 'risk audit', 'psychology', 'expectancy'] },
      { title: 'Reports & Sharing', href: '/docs/features/reports', description: 'Advanced analytics and public reports', keywords: ['share', 'public link', 'charts'] },
      { title: 'Widget Customization', href: '/docs/features/widgets', description: 'Dashboard layout and templates', keywords: ['drag', 'drop', 'resize'] },
      { title: 'Notifications', href: '/docs/features/notifications', description: 'Real-time alerts and push notifications', keywords: ['alerts', 'push'] },
      { title: 'Weekly Review', href: '/docs/features/weekly-review', description: 'Weekly performance summary', keywords: ['summary', 'end of week'] },
      { title: 'Goals', href: '/docs/features/goals', description: 'Set and track trading goals', keywords: ['objectives', 'targets'] },
      { title: 'Demo Mode', href: '/docs/features/demo', description: 'Explore the app with sample data', keywords: ['sample', 'trial'] },
      { title: 'Data Management', href: '/docs/features/data-management', description: 'Account and trade maintenance', keywords: ['delete', 'bulk', 'purge'] },
      { title: 'Data Export', href: '/docs/features/data-export', description: 'Export trades, reports, and analytics', keywords: ['download', 'csv export'] },
      { title: 'Settings', href: '/docs/features/settings', description: 'Profile, preferences, linked accounts', keywords: ['password', 'email', 'profile'] },
      { title: 'Keyboard Shortcuts', href: '/docs/features/shortcuts', description: 'Command palette and hotkeys', keywords: ['cmd', 'ctrl', 'hotkeys', 'palette'] },
    ],
  },
  {
    title: 'Resources',
    icon: FileText,
    items: [
      {
        title: 'FAQ & Troubleshooting',
        href: '/docs/faq',
        description: 'Common questions and solutions',
        subsections: [
          { title: 'Is JJI free?', href: '/docs/faq#is-jji-free' },
          { title: 'How do I import trades?', href: '/docs/faq#how-do-i-import-trades' },
          { title: 'What data formats are supported?', href: '/docs/faq#what-data-formats-are-supported' },
          { title: 'Is there a mobile app?', href: '/docs/faq#is-there-a-mobile-app' },
          { title: 'Where is my data stored?', href: '/docs/faq#where-is-my-data-stored' },
          { title: 'Why does the dashboard look empty?', href: '/docs/faq#why-does-the-dashboard-look-empty' },
          { title: 'How do I cancel my subscription?', href: '/docs/faq#how-do-i-cancel-my-subscription' },
        ],
      },
      { title: 'Feedback Guide', href: '/docs/feedback', description: 'Report bugs and request features' },
       { title: 'Support the Project', href: resolveNavigationPath('donate', { surface: 'docs', isDemo: false }), description: 'Donation and contribution options' },
    ],
  },
  {
    title: 'For Developers',
    icon: Code,
    items: [
      { title: 'Tech Stack', href: '/docs/for-developers/tech-stack', description: 'Technologies used across the platform' },
      { title: 'Frontend Guidelines', href: '/docs/for-developers/frontend', description: 'UI patterns and conventions' },
      { title: 'Backend Structure', href: '/docs/for-developers/backend', description: 'API and server architecture' },
      { title: 'Architecture', href: '/docs/for-developers/architecture', description: 'System organization and boundaries' },
      { title: 'Data Model Principles', href: '/docs/for-developers/database', description: 'Core data domains and rules' },
      { title: 'Database Optimization', href: '/docs/for-developers/database-optimization', description: 'Drizzle ORM and query performance' },
      { title: 'Performance Baseline', href: '/docs/for-developers/performance-baseline', description: 'Performance targets and approach' },
    ],
  },
]

const searchablePages = docsNavigation.flatMap((section) =>
  section.items.flatMap((item) => {
    const pages = [
      {
        title: item.title,
        href: item.href,
        section: section.title,
        parentTitle: null as string | null,
        description: item.description ?? '',
        keywords: item.keywords?.join(' ') ?? '',
      },
    ]

    if (!item.subsections) {
      return pages
    }

    return pages.concat(
      item.subsections.map((subsection) => ({
        title: subsection.title,
        href: subsection.href,
        section: section.title,
        parentTitle: item.title,
        description: item.description ?? '',
        keywords: item.keywords?.join(' ') ?? '',
      }))
    )
  })
)

const docsSearch = new Fuse(searchablePages, {
  keys: [
    { name: 'title', weight: 2.5 },
    { name: 'keywords', weight: 2 },
    { name: 'description', weight: 1.5 },
    { name: 'section', weight: 1 },
    { name: 'parentTitle', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
})

function normalizeHref(href: string) {
  try {
    return new URL(href, 'https://justjournalit.site').pathname
  } catch {
    return href.split('#')[0]
  }
}

function DocsNav({
  pathname,
  docsHref,
  onNavigate,
}: {
  pathname: string
  docsHref: (href?: string) => string
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-6">
      {docsNavigation.map((section) => (
        <section key={section.title} className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
            <section.icon className="h-3.5 w-3.5" />
            <span>{section.title}</span>
          </div>

          <div className="space-y-1">
            {section.items.map((item) => {
              const itemHref = docsHref(item.href)
              const itemPath = normalizeHref(itemHref)
              const itemActive = pathname === itemPath

              return (
                <div key={item.href} className="space-y-1">
                  <Link
                    href={itemHref as any}
                    {...(onNavigate !== undefined && { onClick: onNavigate as any })}
                    className={cn(
                      'group flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                      itemActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{item.title}</span>
                    <ChevronRight
                      className={cn(
                        'ml-auto h-3.5 w-3.5 transition-transform',
                        itemActive ? 'text-primary-foreground/80' : 'translate-x-0.5 text-muted-foreground/60'
                      )}
                    />
                  </Link>

                  {item.subsections && pathname === itemPath && (
                    <div className="ml-3 space-y-1 border-l border-border/70 pl-4">
                      {item.subsections.map((subsection) => (
                        <Link
                          key={subsection.href}
                          href={docsHref(subsection.href) as any}
                          {...(onNavigate !== undefined && { onClick: onNavigate as any })}
                          className="block rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                        >
                          {subsection.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}

function DocsSearchPanel({
  searchQuery,
  setSearchQuery,
  searchResults,
  docsHref,
  inputRef,
}: {
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchResults: Array<{ title: string; href: string; section: string; parentTitle: string | null }>
  docsHref: (href?: string) => string
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const showResults = searchQuery.trim().length >= 2

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || searchResults.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % searchResults.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length)
    } else if (event.key === 'Enter') {
      const selected = searchResults[selectedIndex]
      if (selected) {
        event.preventDefault()
        const targetHref = docsHref(selected.href)
        setSearchQuery('')
        window.location.href = targetHref
      }
    } else if (event.key === 'Escape') {
      setSearchQuery('')
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search docs... (Cmd+K)"
        className="h-10 rounded-2xl border-border/70 bg-background pl-9 pr-14 text-sm shadow-none"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-2xl">
          <div className="max-h-[22rem] overflow-y-auto p-2">
            {searchResults.length > 0 ? (
              searchResults.map((result, idx) => (
                <Link
                  key={result.href}
                  href={docsHref(result.href) as any}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors',
                    idx === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                  )}
                  onClick={() => setSearchQuery('')}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {result.parentTitle ? `${result.parentTitle} / ` : ''}
                      {result.title}
                    </p>
                    <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {result.section}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))
            ) : (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No results found for &quot;{searchQuery.trim()}&quot;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function OpenSourceNotice() {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
        Status Change
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
        JJI was open source until June 19, 2026. The project is currently proprietary, but may be open-sourced again in the future.
      </p>
    </div>
  )
}

export function DocsLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { docsHref, hostname } = usePublicSurfaceRouting()
  const navigationHref = useCallback(
    (href = '/docs') => href === '/donate'
      ? resolveNavigationPath('donate', { surface: 'docs', isDemo: false, hostname })
      : docsHref(href),
    [docsHref, hostname],
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return []
    }

    return docsSearch.search(searchQuery.trim()).slice(0, 8).map((result) => result.item)
  }, [searchQuery])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchQuery('')

    const scrollToHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash) {
        const element = document.getElementById(hash) || document.getElementById(`heading-${hash}`)
        if (element) {
          setTimeout(() => {
            const yOffset = -100
            const y = element.getBoundingClientRect().top + window.scrollY + yOffset
            window.scrollTo({ top: y, behavior: 'smooth' })
          }, 100)
        }
      }
    }

    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [pathname])

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
      <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 items-start gap-6 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="sticky top-[3.5rem] hidden h-[calc(100dvh-3.5rem)] min-h-0 self-start md:block">
          <div className="flex h-full min-h-0 flex-col rounded-[1.75rem] border border-border/70 bg-card/60 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.42)] backdrop-blur-sm">
              <div className="border-b border-border/70 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      Documentation
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Web &amp; Mobile guides, feature references, and developer notes.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] lg:inline-flex">
                    Public
                  </Badge>
                </div>
                <DocsSearchPanel
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchResults={searchResults}
                  docsHref={navigationHref}
                  inputRef={searchInputRef}
                />
                <div className="mt-3">
                  <OpenSourceNotice />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <DocsNav pathname={pathname} docsHref={navigationHref} />
              </div>
          </div>
        </aside>

        <main id="main-content" className="min-w-0 py-6 lg:py-8">
          <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="rounded-2xl">
                  <List className="mr-2 h-4 w-4" />
                  Browse Docs
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[22rem] border-r bg-background p-0">
                <div className="flex h-full flex-col">
                  <div className="border-b border-border/70 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      Documentation
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Search, browse, and jump between the current product guides.
                    </p>
                    <div className="mt-3">
                      <DocsSearchPanel
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchResults={searchResults}
                        docsHref={navigationHref}
                      />
                    </div>
                    <div className="mt-3">
                      <OpenSourceNotice />
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <DocsNav pathname={pathname} docsHref={navigationHref} onNavigate={() => setMobileMenuOpen(false)} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Badge variant="outline" className="rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.18em]">
              Knowledge Base
            </Badge>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-card/40 px-5 py-8 shadow-[0_24px_80px_-42px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-7 lg:px-10 lg:py-10">
            <div
              className="prose prose-invert max-w-none
                prose-headings:scroll-mt-24
                prose-headings:font-bold
                prose-h1:mb-8 prose-h1:border-b prose-h1:pb-4 prose-h1:text-4xl
                prose-h2:mb-6 prose-h2:mt-12 prose-h2:border-b prose-h2:pb-3 prose-h2:text-3xl
                prose-h3:mb-4 prose-h3:mt-10 prose-h3:text-2xl
                prose-h4:mb-3 prose-h4:mt-8 prose-h4:text-xl
                prose-p:my-4 prose-p:leading-7 prose-p:text-muted-foreground
                prose-li:my-2 prose-li:leading-7 prose-li:text-muted-foreground
                prose-ul:my-6 prose-ol:my-6
                prose-code:rounded-md prose-code:border prose-code:bg-accent/50 prose-code:px-2 prose-code:py-1 prose-code:text-sm prose-code:text-foreground prose-code:before:content-[''] prose-code:after:content-['']
                prose-pre:my-6 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-accent/30 prose-pre:p-4
                prose-a:font-medium prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground prose-strong:font-semibold
                prose-img:my-8 prose-img:rounded-xl prose-img:border
                prose-table:my-8 prose-table:border
                prose-th:bg-accent prose-th:p-3 prose-th:font-semibold
                prose-td:p-3
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
                prose-hr:my-12 prose-hr:border-border"
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
