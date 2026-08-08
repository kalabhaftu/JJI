import { HugeiconsIcon } from '@hugeicons/react'
import { Bookmark01Icon, Brain01Icon } from '@hugeicons/core-free-icons'
import { PromptBox } from '@/components/ui/ai-prompt-input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '../types'
import { MessageContent } from './message-content'

interface ConversationViewProps {
  messages: ChatMessage[]
  streamingText: string
  followUps: string[]
  isLoading: boolean
  isSending: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  chatEndRef: React.RefObject<HTMLDivElement | null>
  onSubmit: (prompt: string) => void
  onSaveInsight: (message: ChatMessage) => void
}

export function ConversationView({
  messages,
  streamingText,
  followUps,
  isLoading,
  isSending,
  scrollContainerRef,
  chatEndRef,
  onSubmit,
  onSaveInsight,
}: ConversationViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollContainerRef} aria-live="polite" aria-busy={isSending} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {isLoading ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Spinner size="lg" /> Loading conversation…</div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-7">
            {messages.map((message) => (
              <article key={message.id} className={cn('flex', message.role === 'user' && 'justify-end')}>
                {message.role === 'user' ? (
                  <div className="max-w-[88%] rounded-2xl rounded-br-md bg-muted px-4 py-3 text-sm leading-6 text-foreground sm:max-w-[75%]">{message.content}</div>
                ) : (
                  <div className="group flex w-full items-start gap-3 border-b border-border/50 pb-7 last:border-0">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HugeiconsIcon icon={Brain01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" /></span>
                    <div className="min-w-0 flex-1"><MessageContent content={message.content} /></div>
                    <button type="button" aria-label="Save response as insight" title="Save insight" onClick={() => onSaveInsight(message)} className="touch-target-compact inline-flex items-center justify-center rounded-lg text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"><HugeiconsIcon icon={Bookmark01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" /></button>
                  </div>
                )}
              </article>
            ))}

            {streamingText && (
              <article className="flex items-start gap-3 border-b border-border/50 pb-7">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HugeiconsIcon icon={Brain01Icon} className="h-4 w-4 animate-pulse" strokeWidth={2} color="currentColor" /></span>
                <div className="min-w-0 flex-1"><MessageContent content={streamingText} /></div>
              </article>
            )}

            {isSending && !streamingText && <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground"><Spinner size="sm" /> Analyzing selected evidence…</div>}

            {messages.length > 0 && !isSending && !streamingText && (
              <section aria-labelledby="follow-up-heading" className="pt-2">
                <h2 id="follow-up-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Continue the analysis</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {followUps.map((followUp) => <button key={followUp} type="button" onClick={() => onSubmit(followUp)} className="min-h-10 rounded-full border border-border/80 bg-[hsl(var(--surface-raised))] px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--border-strong))] hover:text-foreground">{followUp}</button>)}
                </div>
              </section>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-3xl">
          <PromptBox onSubmit={onSubmit} placeholder="Ask a follow-up grounded in this conversation…" disabled={isSending} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Verify material trading decisions against your original records.</p>
        </div>
      </div>
    </div>
  )
}
