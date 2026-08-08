'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Brain01Icon, Tick01Icon, Edit03Icon, InformationCircleIcon, PanelLeftIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { useData } from '@/context/data-provider'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { followUpSuggestions } from './ai-config'
import { ContextComposer } from './components/context-composer'
import { ConversationView } from './components/conversation-view'
import { ReviewDialog } from './components/review-dialog'
import { WorkspaceSidebar } from './components/workspace-sidebar'
import type { ChatMessage, ChatSession, SavedInsight, WeeklyReview, WorkspaceAccount, WorkspaceTab } from './types'
import { useAiWorkspaceData } from './hooks/use-ai-workspace-data'
import { reportClientError } from '@/lib/observability/report-error'
import { apiRequest, apiRequestData, ApiClientError } from '@/lib/api/client'
import { apiStreamRequest } from '@/lib/api/stream-client'

export default function AIChatWorkspace() {
  const { accounts, isDemoMode } = useData()
  const {
    chats,
    savedInsights,
    weeklyAIReviews,
    isLoadingChats,
    paywallError,
    aiConsentGranted,
    updateChats,
    updateInsights,
    saveConsent,
    revokeConsent,
  } = useAiWorkspaceData(isDemoMode)

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chats')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last-30-days')
  const [customFromDate, setCustomFromDate] = useState<string>('')
  const [customToDate, setCustomToDate] = useState<string>('')
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'trades', 'journals', 'performance', 'statistics'
  ])

  const [isSending, setIsSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isRenameMode, setIsRenameMode] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false)
  const [isSavingConsent, setIsSavingConsent] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<{ prompt: string; sources?: string[] } | null>(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false)

  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [selectedReview, setSelectedReview] = useState<WeeklyReview | null>(null)
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, streamingText])

  useEffect(() => {
    if (accounts && accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts([accounts[0]!.id])
    }
  }, [accounts, selectedAccounts.length])

  const handleChatSelect = async (chatId: string) => {
    setSelectedChatId(chatId)
    setIsLoadingMessages(true)
    setStreamingText('')

    if (isDemoMode) {
      if (chatId === 'demo-1') {
        setMessages([
          { id: 'm1', role: 'user', content: 'What is my risk per trade across the funded account?', createdAt: new Date(Date.now() - 3600000).toISOString() },
          {
            id: 'm2',
            role: 'assistant',
            content: `### Key Findings
Your average risk per trade is highly inconsistent, swinging from $120 to over $450 per trade.

### Root Causes
- Sizing up after consecutive wins (overconfidence trap).
- Changing stop loss sizes mid-trade instead of using pre-calculated sizes.

### Evidence
- On **Funded Account**, your largest single loss was **$680** on ES, while your average win was only **$190**.
- Risk-to-Reward ratio is currently skewed at **0.42** (average win divided by average loss), creating a negative edge.

### Recommended Actions
- Set a hard max loss limit of **$200** per trade.
- Standardize stop loss parameters at entry and never slide stops wider.`,
            createdAt: new Date(Date.now() - 3500000).toISOString()
          }
        ])
      } else {
        setMessages([
          { id: 'm3', role: 'user', content: 'Analyze my journal for emotional patterns.', createdAt: new Date(Date.now() - 7200000).toISOString() },
          {
            id: 'm4',
            role: 'assistant',
            content: `### Key Findings

Emotional states directly correlate with performance. Operating under stress or frustration is highly destructive.

### Root Causes
- Trading before 9:30 AM EST often results in impulsive entries because you feel you are "missing out" (FOMO).
- Lack of patience when market consolidates.

### Evidence
- Days logged as **Frustrated** or **Impulsive** generated **-$840** in P&L across 7 trades.
- Days logged as **Focused** or **Disciplined** generated **+$1,250** across 12 trades.

### Recommended Actions
- Perform a 5-minute breathing exercise before opening trading platform.
- Write down your pre-trade checklist: if rules are not met, close the laptop.`,
            createdAt: new Date(Date.now() - 7100000).toISOString()
          }
        ])
      }
      setIsLoadingMessages(false)
      return
    }

    try {
      const data = await apiRequestData<{ messages?: ChatMessage[] } | null>(`/api/v1/ai/chats/${chatId}`, {
        retry: { mode: 'safe' },
        operation: 'load-ai-chat-messages',
      })
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
    } catch (error) {
      reportClientError(error, { operation: 'load-ai-chat-messages', route: '/api/v1/ai/chats' })
      toast.error('Failed to load chat history.')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleStartChat = async (customPrompt?: string, sourceOverride?: string[], consentConfirmed = false) => {
    if (isSending) return
    const promptToSend = customPrompt || ''
    if (!promptToSend.trim()) return

    if (!isDemoMode && !aiConsentGranted && !consentConfirmed) {
      setPendingPrompt({
        prompt: promptToSend,
        ...(sourceOverride ? { sources: sourceOverride } : {}),
      })
      setIsConsentDialogOpen(true)
      return
    }

    setIsSending(true)

    if (isDemoMode) {

      const newChat: ChatSession = {
        id: `demo-${Date.now()}`,
        title: promptToSend.slice(0, 30) + '...',
        isPinned: false,
        isArchived: false,
        accounts: selectedAccounts,
        dateRange: selectedDateRange,
        customFrom: null,
        customTo: null,
        dataSources: sourceOverride || selectedSources,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      updateChats(prev => [newChat, ...(prev ?? [])])
      setSelectedChatId(newChat.id)

      const userMsg: ChatMessage = {
        id: `m-u-${Date.now()}`,
        role: 'user',
        content: promptToSend,
        createdAt: new Date().toISOString()
      }
      setMessages([userMsg])

      const fullText = `### Key Findings
[DEMO MODE PREVIEW] You are experiencing the AI assistant simulator.
With an active workspace, the assistant analyzes your actual trading records. Here is a sample analysis of the demo data:

### Root Causes
- Inconsistent risk rules.
- Trading during high-impact news releases without an edge.

### Evidence
- Your simulated win rate is **48%**.
- Profit factor is **1.14** over 30 days.

### Recommended Actions
- Upgrade your subscription to connect live MT4/5, Rithmic, or dxFeed accounts and review your actual performance.
- Maintain a strict rule of no news trading.`

      let current = ''
      const words = fullText.split(' ')
      let i = 0

      const interval = setInterval(() => {
        if (i < words.length) {
          current += words[i]! + ' '
          setStreamingText(current)
          i++
        } else {
          clearInterval(interval)
          const assistantMsg: ChatMessage = {
            id: `m-a-${Date.now()}`,
            role: 'assistant',
            content: fullText,
            createdAt: new Date().toISOString()
          }
          setMessages(prev => [...prev, assistantMsg])
          setStreamingText('')
          setIsSending(false)
        }
      }, 70)
      return
    }

    const requireConsent = () => {
      revokeConsent()
      setPendingPrompt({
        prompt: promptToSend,
        ...(sourceOverride ? { sources: sourceOverride } : {}),
      })
      setIsConsentDialogOpen(true)
    }

    try {

      let chatId = selectedChatId
      if (!chatId) {
        const created = await apiRequest<ChatSession>('/api/v1/ai/chats', {
          method: 'POST',
          body: JSON.stringify({
            title: promptToSend.slice(0, 40) + '...',
            accounts: selectedAccounts,
            dateRange: selectedDateRange,
            customFrom: selectedDateRange === 'custom' ? customFromDate : null,
            customTo: selectedDateRange === 'custom' ? customToDate : null,
            dataSources: sourceOverride || selectedSources
          }),
          retry: { mode: 'never' },
          operation: 'create-ai-chat',
        })
        const createdChat = created.data
        if (!createdChat) throw new Error('Failed to start conversation.')
        updateChats(prev => [createdChat, ...(prev ?? [])])
        chatId = createdChat.id
        setSelectedChatId(chatId)
      }

      const userMsg: ChatMessage = {
        id: `local-u-${Date.now()}`,
        role: 'user',
        content: promptToSend,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, userMsg])

      let streamError: unknown = null
      try {
        const streamResponse = await apiStreamRequest(`/api/v1/ai/chats/${chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ prompt: promptToSend }),
          operation: 'send-ai-chat-message',
        })

        const reader = streamResponse.body?.getReader()
        const decoder = new TextDecoder()
        let assistantResponse = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)

            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('0:')) {
                try {
                  assistantResponse += JSON.parse(line.slice(2))
                  setStreamingText(assistantResponse)
                } catch {
                  continue
                }
              }
            }
          }
        }
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.status === 412 &&
          error.code === 'AI_DATA_CONSENT_REQUIRED'
        ) {
          requireConsent()
          return
        }
        streamError = error
      }

      if (streamError) {
        reportClientError(streamError, { operation: 'send-ai-chat-message', route: `/api/v1/ai/chats/${chatId}/messages` })
        toast.error(streamError instanceof Error ? streamError.message : 'Failed to send message.')
        return
      }

      try {
        const data = await apiRequestData<{ messages?: ChatMessage[] } | null>(`/api/v1/ai/chats/${chatId}`, {
          operation: 'reload-ai-chat-messages',
        })
        if (Array.isArray(data?.messages)) setMessages(data.messages)
      } catch (error) {
        reportClientError(error, { operation: 'reload-ai-chat-messages', route: `/api/v1/ai/chats/${chatId}` })
      }

      setStreamingText('')

      try {
        const chatList = await apiRequestData<ChatSession[] | null>('/api/v1/ai/chats', {
          operation: 'reload-ai-chats',
        })
        if (Array.isArray(chatList)) updateChats(() => chatList)
      } catch (error) {
        reportClientError(error, { operation: 'reload-ai-chats', route: '/api/v1/ai/chats' })
      }

    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.status === 412 &&
        error.code === 'AI_DATA_CONSENT_REQUIRED'
      ) {
        requireConsent()
      } else {
        reportClientError(error, { operation: 'send-ai-chat-message', route: '/api/v1/ai/chat' })
        toast.error(error instanceof Error ? error.message : 'An error occurred during response transmission.')
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleTogglePin = async (chat: ChatSession) => {
    if (isDemoMode) {
      updateChats(prev => (prev ?? []).map(c => c.id === chat.id ? { ...c, isPinned: !c.isPinned } : c))
      toast.success(chat.isPinned ? 'Chat unpinned' : 'Chat pinned')
      return
    }

    try {
      await apiRequest(`/api/v1/ai/chats/${chat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !chat.isPinned }),
        retry: { mode: 'never' },
        operation: 'toggle-ai-chat-pin',
      })
      updateChats(prev => (prev ?? []).map(c => c.id === chat.id ? { ...c, isPinned: !chat.isPinned } : c))
      toast.success(chat.isPinned ? 'Chat unpinned' : 'Chat pinned')
    } catch (error) {
      reportClientError(error, { operation: 'toggle-ai-chat-pin', route: '/api/v1/ai/chats' })
      toast.error('Failed to pin chat.')
    }
  }

  const handleToggleArchive = async (chat: ChatSession) => {
    if (isDemoMode) {
      updateChats(prev => (prev ?? []).map(c => c.id === chat.id ? { ...c, isArchived: !c.isArchived } : c))
      toast.success(chat.isArchived ? 'Chat restored' : 'Chat archived')
      return
    }

    try {
      await apiRequest(`/api/v1/ai/chats/${chat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !chat.isArchived }),
        retry: { mode: 'never' },
        operation: 'toggle-ai-chat-archive',
      })
      updateChats(prev => (prev ?? []).map(c => c.id === chat.id ? { ...c, isArchived: !chat.isArchived } : c))
      toast.success(chat.isArchived ? 'Chat restored' : 'Chat archived')
      if (selectedChatId === chat.id) {
        setSelectedChatId(null)
        setMessages([])
      }
    } catch (error) {
      reportClientError(error, { operation: 'toggle-ai-chat-archive', route: '/api/v1/ai/chats' })
      toast.error('Failed to archive chat.')
    }
  }

  const handleRequestDelete = (chatId: string) => {
    setDeleteChatId(chatId)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteChatId) return
    const chatId = deleteChatId
    setIsDeleteDialogOpen(false)
    setDeleteChatId(null)

    if (isDemoMode) {
      updateChats(prev => (prev ?? []).filter(c => c.id !== chatId))
      if (selectedChatId === chatId) {
        setSelectedChatId(null)
        setMessages([])
      }
      toast.success('Chat deleted')
      return
    }

    try {
      await apiRequest(`/api/v1/ai/chats/${chatId}`, {
        method: 'DELETE',
        retry: { mode: 'never' },
        operation: 'delete-ai-chat',
      })
      updateChats(prev => (prev ?? []).filter(c => c.id !== chatId))
      if (selectedChatId === chatId) {
        setSelectedChatId(null)
        setMessages([])
      }
      toast.success('Conversation deleted')
    } catch (error) {
      reportClientError(error, { operation: 'delete-ai-chat', route: '/api/v1/ai/chats' })
      toast.error('Failed to delete chat.')
    }
  }

  const handleRenameChat = async (chatId: string) => {
    if (!renameValue.trim()) return

    if (isDemoMode) {
      updateChats(prev => (prev ?? []).map(c => c.id === chatId ? { ...c, title: renameValue } : c))
      setIsRenameMode(false)
      toast.success('Chat renamed')
      return
    }

    try {
      await apiRequest(`/api/v1/ai/chats/${chatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: renameValue }),
        retry: { mode: 'never' },
        operation: 'rename-ai-chat',
      })
      updateChats(prev => (prev ?? []).map(c => c.id === chatId ? { ...c, title: renameValue } : c))
      setIsRenameMode(false)
      toast.success('Chat renamed')
    } catch (error) {
      reportClientError(error, { operation: 'rename-ai-chat', route: '/api/v1/ai/chats' })
      toast.error('Failed to rename chat.')
    }
  }

  const handleSaveInsight = async (msg: ChatMessage) => {
    if (isDemoMode) {
      const newInsight: SavedInsight = {
        id: `insight-${Date.now()}`,
        title: 'Key AI Insight',
        content: msg.content,
        category: 'insight',
        createdAt: new Date().toISOString()
      }
      updateInsights(prev => [newInsight, ...(prev ?? [])])
      toast.success('Insight saved to library!')
      return
    }

    try {
      const response = await apiRequest<SavedInsight>('/api/v1/ai/insights', {
        method: 'POST',
        body: JSON.stringify({
          title: 'AI Analysis: ' + new Date().toLocaleDateString(),
          content: msg.content,
          category: 'insight'
        }),
        retry: { mode: 'never' },
        operation: 'save-ai-insight',
      })

      if (response.data) {
        updateInsights(prev => [response.data as SavedInsight, ...(prev ?? [])])
        toast.success('Insight saved to library!')
      }
    } catch (error) {
      reportClientError(error, { operation: 'save-ai-insight', route: '/api/v1/ai/insights' })
      toast.error('Failed to save insight.')
    }
  }

  const handleDeleteInsight = async (insightId: string) => {
    if (isDemoMode) {
      updateInsights(prev => (prev ?? []).filter(i => i.id !== insightId))
      toast.success('Insight removed')
      return
    }

    try {
      await apiRequest(`/api/v1/ai/insights/${insightId}`, {
        method: 'DELETE',
        retry: { mode: 'never' },
        operation: 'delete-ai-insight',
      })
      updateInsights(prev => (prev ?? []).filter(i => i.id !== insightId))
      toast.success('Insight removed')
    } catch (error) {
      reportClientError(error, { operation: 'delete-ai-insight', route: '/api/v1/ai/insights' })
      toast.error('Failed to delete insight.')
    }
  }

  const handleSourceToggle = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  const handleAccountToggle = (accId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accId)
        ? prev.filter(a => a !== accId)
        : [...prev, accId]
    )
  }

  const getFollowUps = () => {
    if (messages.length === 0) return []

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const content = lastUserMsg?.content.toLowerCase() || ''

    if (content.includes('risk') || content.includes('drawdown')) return followUpSuggestions.risk
    if (content.includes('journal') || content.includes('emotion')) return followUpSuggestions.psychology
    if (content.includes('performance') || content.includes('win')) return followUpSuggestions.performance

    return followUpSuggestions.default
  }

  const handleAcceptAiConsent = async () => {
    if (!pendingPrompt || isSavingConsent) return
    setIsSavingConsent(true)
    const consentAt = new Date().toISOString()
    try {
      await saveConsent(consentAt)
      const request = pendingPrompt
      setPendingPrompt(null)
      setIsConsentDialogOpen(false)
      await handleStartChat(request.prompt, request.sources, true)
    } catch (error) {
      reportClientError(error, { operation: 'save-ai-data-consent', route: '/api/v1/user/preferences' })
      toast.error('Could not save your AI data preference.')
    } finally {
      setIsSavingConsent(false)
    }
  }

  if (paywallError) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <HugeiconsIcon icon={Brain01Icon} className="h-6 w-6" strokeWidth={2} color="currentColor" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI performance assistant</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{paywallError}</p>
        </div>
        <Button size="lg" asChild><Link href="/subscribe">View plans</Link></Button>
      </div>
    )
  }

  const currentChat = chats.find((chat) => chat.id === selectedChatId)
  const followUps = getFollowUps() ?? []

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background lg:h-[calc(100dvh-4rem)] lg:flex-row">
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the conversation and all of its messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteChatId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConsentDialogOpen} onOpenChange={(open) => {
        setIsConsentDialogOpen(open)
        if (!open) setPendingPrompt(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow AI analysis of selected trading data?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">JJI will send the question and only the data sources you selected—such as trades, performance metrics, or journal notes—to xAI to generate a response. Conversations and saved insights remain in your JJI workspace.</span>
              <span className="block">Do not include secrets or information you do not want processed by the AI provider. You can review the <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">privacy policy</Link> before continuing.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingConsent}>Not now</AlertDialogCancel>
            <AlertDialogAction disabled={isSavingConsent} onClick={handleAcceptAiConsent}>{isSavingConsent ? 'Saving…' : 'Allow and continue'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReviewDialog
        open={isReviewDialogOpen}
        review={selectedReview}
        index={selectedReviewIndex}
        total={weeklyAIReviews.length}
        isSending={isSending}
        onOpenChange={setIsReviewDialogOpen}
        onNavigate={(index) => {
          setSelectedReviewIndex(index)
          setSelectedReview(weeklyAIReviews[index] ?? null)
        }}
        onDiscuss={(review) => {
          setIsReviewDialogOpen(false)
          setSelectedChatId(null)
          setMessages([])
          handleStartChat(`Summarize and expand on my weekly analysis: ${review.summary || 'Review this weekly report.'}`)
        }}
      />

      {!sidebarCollapsed && (
        <WorkspaceSidebar
          className="hidden lg:flex"
          activeTab={activeTab}
          chats={chats}
          insights={savedInsights}
          reviews={weeklyAIReviews}
          selectedChatId={selectedChatId}
          isLoading={isLoadingChats}
          onTabChange={setActiveTab}
          onCollapse={() => setSidebarCollapsed(true)}
          onNewChat={() => {
            setSelectedChatId(null)
            setMessages([])
          }}
          onChatSelect={handleChatSelect}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onDeleteChat={handleRequestDelete}
          onDeleteInsight={handleDeleteInsight}
          onReviewSelect={(review, index) => {
            setSelectedReview(review)
            setSelectedReviewIndex(index)
            setIsReviewDialogOpen(true)
          }}
        />
      )}

      <Dialog open={mobileWorkspaceOpen} onOpenChange={setMobileWorkspaceOpen}>
        <DialogContent className="bottom-0 left-0 top-auto h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none p-0 lg:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Assistant workspace</DialogTitle>
            <DialogDescription>Choose a conversation, saved insight, or weekly review.</DialogDescription>
          </DialogHeader>
          <WorkspaceSidebar
            activeTab={activeTab}
            chats={chats}
            insights={savedInsights}
            reviews={weeklyAIReviews}
            selectedChatId={selectedChatId}
            isLoading={isLoadingChats}
            onTabChange={setActiveTab}
            onCollapse={() => setMobileWorkspaceOpen(false)}
            onNewChat={() => {
              setSelectedChatId(null)
              setMessages([])
              setMobileWorkspaceOpen(false)
            }}
            onChatSelect={(id) => {
              handleChatSelect(id)
              setMobileWorkspaceOpen(false)
            }}
            onTogglePin={handleTogglePin}
            onToggleArchive={handleToggleArchive}
            onDeleteChat={handleRequestDelete}
            onDeleteInsight={handleDeleteInsight}
            onReviewSelect={(review, index) => {
              setSelectedReview(review)
              setSelectedReviewIndex(index)
              setIsReviewDialogOpen(true)
              setMobileWorkspaceOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Assistant conversation">
        {isDemoMode && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-[hsl(var(--surface-subtle))] px-4 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><HugeiconsIcon icon={InformationCircleIcon} className="h-4 w-4 shrink-0" strokeWidth={2} color="currentColor" /><span><strong className="text-foreground">Demo data.</strong> Responses are examples, not analysis of a connected account.</span></p>
            <Button size="sm" asChild><Link href="/subscribe">Upgrade</Link></Button>
          </div>
        )}

        <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-border/70 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button className="lg:hidden" variant="tertiary" size="icon" onClick={() => setMobileWorkspaceOpen(true)} aria-label="Open workspace library"><HugeiconsIcon icon={PanelLeftIcon} size={24} strokeWidth={2} color="currentColor" /></Button>
            {sidebarCollapsed && <Button className="hidden lg:inline-flex" variant="tertiary" size="icon" onClick={() => setSidebarCollapsed(false)} aria-label="Open workspace library"><HugeiconsIcon icon={PanelLeftIcon} size={24} strokeWidth={2} color="currentColor" /></Button>}
            {selectedChatId ? (
              isRenameMode ? (
                <div className="flex min-w-0 items-center gap-1">
                  <label className="sr-only" htmlFor="conversation-title">Conversation title</label>
                  <input id="conversation-title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleRenameChat(selectedChatId)} autoFocus className="h-10 min-w-0 max-w-72 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring" />
                  <Button variant="tertiary" size="icon" onClick={() => handleRenameChat(selectedChatId)} aria-label="Save conversation title"><HugeiconsIcon icon={Tick01Icon} size={24} strokeWidth={2} color="currentColor" /></Button>
                  <Button variant="tertiary" size="icon" onClick={() => setIsRenameMode(false)} aria-label="Cancel rename"><HugeiconsIcon icon={Cancel01Icon} size={24} strokeWidth={2} color="currentColor" /></Button>
                </div>
              ) : (
                <>
                  <HugeiconsIcon icon={Brain01Icon} className="h-4 w-4 shrink-0" strokeWidth={2} color="currentColor" />
                  <h1 className="truncate text-sm font-semibold">{currentChat?.title || 'Active conversation'}</h1>
                  <Button
                    variant="tertiary"
                    size="icon"
                    className="touch-target-compact h-8 w-8"
                    onClick={() => {
                      setRenameValue(currentChat?.title || '')
                      setIsRenameMode(true)
                    }}
                    aria-label="Rename conversation"
                  >
                    <HugeiconsIcon icon={Edit03Icon} size={24} strokeWidth={2} color="currentColor" />
                  </Button>
                </>
              )
            ) : (
              <div>
                <h1 className="text-sm font-semibold">New analysis</h1>
                <p className="hidden text-xs text-muted-foreground sm:block">Define the evidence before you ask.</p>
              </div>
            )}
          </div>
          {selectedChatId && (
            <Button variant="secondary" size="sm" onClick={() => {
              setSelectedChatId(null)
              setMessages([])
            }}>Change context</Button>
          )}
        </header>

        {selectedChatId ? (
          <ConversationView
            messages={messages}
            streamingText={streamingText}
            followUps={followUps}
            isLoading={isLoadingMessages}
            isSending={isSending}
            scrollContainerRef={scrollContainerRef}
            chatEndRef={chatEndRef}
            onSubmit={(prompt) => handleStartChat(prompt)}
            onSaveInsight={handleSaveInsight}
          />
        ) : (
          <ContextComposer
            accounts={accounts as WorkspaceAccount[]}
            selectedAccounts={selectedAccounts}
            selectedDateRange={selectedDateRange}
            customFromDate={customFromDate}
            customToDate={customToDate}
            selectedSources={selectedSources}
            isSending={isSending}
            onAccountToggle={handleAccountToggle}
            onSelectAllAccounts={() => setSelectedAccounts(accounts.map((account) => account.id))}
            onClearAccounts={() => setSelectedAccounts([])}
            onDateRangeChange={setSelectedDateRange}
            onCustomFromDateChange={setCustomFromDate}
            onCustomToDateChange={setCustomToDate}
            onSourceToggle={handleSourceToggle}
            onSubmit={(prompt, sourceOverride) => handleStartChat(prompt, sourceOverride)}
          />
        )}
      </section>
    </div>
  )
}