import { HugeiconsIcon } from '@hugeicons/react'
import { ArchiveIcon, EyeIcon, HistoryIcon, PanelLeftCloseIcon, PinIcon, Add01Icon, Delete02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { ChatSession, SavedInsight, WeeklyReview, WorkspaceTab } from '../types'

interface WorkspaceSidebarProps {
  className?: string
  activeTab: WorkspaceTab
  chats: ChatSession[]
  insights: SavedInsight[]
  reviews: WeeklyReview[]
  selectedChatId: string | null
  isLoading: boolean
  onTabChange: (tab: WorkspaceTab) => void
  onCollapse: () => void
  onNewChat: () => void
  onChatSelect: (id: string) => void
  onTogglePin: (chat: ChatSession) => void
  onToggleArchive: (chat: ChatSession) => void
  onDeleteChat: (id: string) => void
  onDeleteInsight: (id: string) => void
  onReviewSelect: (review: WeeklyReview, index: number) => void
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'chats', label: 'Chats' },
  { id: 'insights', label: 'Insights' },
  { id: 'history', label: 'Reviews' },
]

export function WorkspaceSidebar({
  className,
  activeTab,
  chats,
  insights,
  reviews,
  selectedChatId,
  isLoading,
  onTabChange,
  onCollapse,
  onNewChat,
  onChatSelect,
  onTogglePin,
  onToggleArchive,
  onDeleteChat,
  onDeleteInsight,
  onReviewSelect,
}: WorkspaceSidebarProps) {
  return (
    <aside aria-label="AI workspace library" className={cn("flex h-full w-full shrink-0 flex-col bg-[hsl(var(--surface-raised))] lg:w-80 lg:border-r", className)}>
      <div className="flex min-h-14 items-center justify-between px-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Assistant workspace</p>
          <p className="text-xs text-muted-foreground">Conversations and saved work</p>
        </div>
        <Button variant="tertiary" size="icon" onClick={onCollapse} aria-label="Collapse workspace library">
          <HugeiconsIcon icon={PanelLeftCloseIcon} size={24} strokeWidth={2} color="currentColor" />
        </Button>
      </div>

      <div role="tablist" aria-label="Workspace library" className="grid grid-cols-3 border-y border-border/70 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`workspace-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`workspace-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'min-h-9 rounded-lg px-2 text-xs font-semibold transition-colors',
              activeTab === tab.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`workspace-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`workspace-tab-${activeTab}`}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {activeTab === 'chats' && (
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start border-dashed" onClick={onNewChat}>
              <HugeiconsIcon icon={Add01Icon} size={24} strokeWidth={2} color="currentColor" /> New conversation
            </Button>
            {isLoading ? (
              <div className="flex justify-center py-8"><Spinner size="sm" /></div>
            ) : chats.length === 0 ? (
              <EmptyState>No conversations yet.</EmptyState>
            ) : (
              <div className="space-y-1">
                {chats.filter((chat) => !chat.isArchived).map((chat) => (
                  <div key={chat.id} className={cn('group flex items-center rounded-xl', selectedChatId === chat.id ? 'bg-muted' : 'hover:bg-muted/60')}>
                    <button
                      type="button"
                      onClick={() => onChatSelect(chat.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left"
                      aria-current={selectedChatId === chat.id ? 'true' : undefined}
                    >
                      {chat.isPinned ? <HugeiconsIcon icon={PinIcon} className="h-3.5 w-3.5 shrink-0" strokeWidth={2} color="currentColor" /> : <HugeiconsIcon icon={HistoryIcon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} color="currentColor" />}
                      <span className="truncate text-xs font-medium">{chat.title}</span>
                    </button>
                    <div className="flex pr-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <IconAction label={chat.isPinned ? 'Unpin conversation' : 'Pin conversation'} onClick={() => onTogglePin(chat)}><HugeiconsIcon icon={PinIcon} strokeWidth={2} color="currentColor" /></IconAction>
                      <IconAction label="Archive conversation" onClick={() => onToggleArchive(chat)}><HugeiconsIcon icon={ArchiveIcon} strokeWidth={2} color="currentColor" /></IconAction>
                      <IconAction label="Delete conversation" destructive onClick={() => onDeleteChat(chat.id)}><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} color="currentColor" /></IconAction>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="divide-y divide-border/70">
            {insights.length === 0 ? <EmptyState>No saved insights yet.</EmptyState> : insights.map((insight) => (
              <article key={insight.id} className="group py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-semibold text-foreground">{insight.title}</h3>
                  <IconAction label="Delete insight" destructive onClick={() => onDeleteInsight(insight.id)}><HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} color="currentColor" /></IconAction>
                </div>
                <p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground">{insight.content}</p>
                <time className="mt-2 block text-[10px] text-muted-foreground" dateTime={insight.createdAt}>{format(new Date(insight.createdAt), 'MMM d, yyyy')}</time>
              </article>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="divide-y divide-border/70">
            {reviews.length === 0 ? <EmptyState>No weekly reviews yet.</EmptyState> : reviews.map((review, index) => (
              <button key={`${review.weekStart ?? 'review'}-${index}`} type="button" onClick={() => onReviewSelect(review, index)} className="group w-full py-3 text-left first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">Weekly performance review</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{review.grade || review.riskGrade || '—'}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{review.summary || 'Open the review for details.'}</p>
                <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-foreground"><HugeiconsIcon icon={EyeIcon} className="h-3 w-3" strokeWidth={2} color="currentColor" /> View review</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function IconAction({ label, destructive, onClick, children }: { label: string; destructive?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('touch-target-compact inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5', destructive && 'hover:text-destructive')}>
      {children}
    </button>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>
}
