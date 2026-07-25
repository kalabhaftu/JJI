'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Brain, Check, Edit3, Info, PanelLeft, X } from 'lucide-react'
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
import { toast } from 'sonner'
import { format } from 'date-fns'
import { followUpSuggestions } from './ai-config'
import { ContextComposer } from './components/context-composer'
import { ConversationView } from './components/conversation-view'
import { ReviewDialog } from './components/review-dialog'
import { WorkspaceSidebar } from './components/workspace-sidebar'
import type { ChatMessage, ChatSession, SavedInsight, WeeklyReview, WorkspaceAccount, WorkspaceTab } from './types'
import { AI_DATA_CONSENT_VERSION } from '@/lib/user-settings'

export default function AIChatWorkspace() {
  const { accounts, isDemoMode } = useData()
  
  // State variables
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chats')
  const [chats, setChats] = useState<ChatSession[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([])
  const [weeklyAIReviews, setWeeklyAIReviews] = useState<WeeklyReview[]>([])
  
  // Context Selection States
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last-30-days')
  const [customFromDate, setCustomFromDate] = useState<string>('')
  const [customToDate, setCustomToDate] = useState<string>('')
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'trades', 'journals', 'performance', 'statistics'
  ])
  
  // Chatting State
  const [isSending, setIsSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isRenameMode, setIsRenameMode] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [paywallError, setPaywallError] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState<Record<string, unknown>>({})
  const [aiConsentGranted, setAiConsentGranted] = useState(false)
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false)
  const [isSavingConsent, setIsSavingConsent] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<{ prompt: string; sources?: string[] } | null>(null)
  
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Delete confirmation state
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Full-screen analysis dialog
  const [selectedReview, setSelectedReview] = useState<WeeklyReview | null>(null)
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto Scroll Chat
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, streamingText])

  useEffect(() => {
    if (isDemoMode) {
      const demoChats: ChatSession[] = [
        {
          id: 'demo-1',
          title: 'Review Risk on NQ & ES',
          isPinned: true,
          isArchived: false,
          accounts: ['demo-funded'],
          dateRange: 'last-30-days',
          customFrom: null,
          customTo: null,
          dataSources: ['trades', 'statistics'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'demo-2',
          title: 'Psychology Audit: Anxious Days',
          isPinned: false,
          isArchived: false,
          accounts: ['demo-personal'],
          dateRange: 'last-90-days',
          customFrom: null,
          customTo: null,
          dataSources: ['journals'],
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]
      setChats(demoChats)
      
      const demoInsights: SavedInsight[] = [
        {
          id: 'insight-1',
          title: 'Revenge Trading Pattern Identified',
          content: 'Data shows a 73% loss rate on trades taken within 45 minutes of a losing trade. Sizing is 1.5x larger on average due to revenge impulse.',
          category: 'mistake',
          createdAt: new Date().toISOString()
        }
      ]
      setSavedInsights(demoInsights)
      setIsLoadingChats(false)
    } else {
      // Fetch user chats, insights, and reviews
      loadWorkspaceData()
    }
  }, [isDemoMode])

  const loadWorkspaceData = async () => {
    setIsLoadingChats(true)
    setPaywallError(null)
    try {
      const [chatsRes, insightsRes, profileRes] = await Promise.all([
        fetch('/api/v1/ai/chats'),
        fetch('/api/v1/ai/insights'),
        fetch('/api/auth/profile') // to check if paywalled
      ])

      if (chatsRes.status === 403 || insightsRes.status === 403) {
        const payload = await chatsRes.json()
        setPaywallError(payload.error || 'Upgrade to a Pro plan to use the AI assistant.')
        setIsLoadingChats(false)
        return
      }

      if (chatsRes.ok) {
        const payload = await chatsRes.json()
        setChats(payload.data || [])
      }

      if (insightsRes.ok) {
        const payload = await insightsRes.json()
        setSavedInsights(payload.data || [])
      }

      if (profileRes.ok) {
        const payload = await profileRes.json()
        const settings = payload.data?.aiSettings && typeof payload.data.aiSettings === 'object'
          ? payload.data.aiSettings as Record<string, unknown>
          : {}
        setAiSettings(settings)
        setAiConsentGranted(Boolean(
          settings.dataProcessingConsentAt &&
          settings.dataProcessingConsentVersion === AI_DATA_CONSENT_VERSION
        ))
      }
      
      // Also fetch weekly reviews
      const reviewsRes = await fetch('/api/v1/weekly-review')
      let loadedReviews: any[] = []
      if (reviewsRes.ok) {
        const payload = await reviewsRes.json()
        if (payload.success && Array.isArray(payload.data)) {
          loadedReviews = payload.data
        }
      }

      // If no historical reviews exist, generate the live one for last 30 days
      if (loadedReviews.length === 0) {
        const liveRes = await fetch('/api/v1/journal/ai-analysis?startDate=' + format(subDays(new Date(), 30), 'yyyy-MM-dd') + '&endDate=' + format(new Date(), 'yyyy-MM-dd'))
        if (liveRes.ok) {
          const liveData = await liveRes.json()
          if (liveData.analysis) {
            loadedReviews = [liveData.analysis]
          }
        }
      }
      setWeeklyAIReviews(loadedReviews)
    } catch (err) {
      toast.error('Failed to load AI Assistant data.')
    } finally {
      setIsLoadingChats(false)
    }
  }

  // Pre-populate account selector when accounts are loaded
  useEffect(() => {
    if (accounts && accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts([accounts[0]!.id])
    }
  }, [accounts, selectedAccounts.length])

  // Fetch Messages for Selected Chat
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
      const response = await fetch(`/api/v1/ai/chats/${chatId}`)
      if (response.ok) {
        const payload = await response.json()
        setMessages(payload.data?.messages || [])
      }
    } catch {
      toast.error('Failed to load chat history.')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Create Chat and Send Message
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
      // Simulate Demo Streaming Response
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
      
      setChats(prev => [newChat, ...prev])
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
- Upgrade your subscription to connect live MT4/5, Rithmic, or dxFeed accounts and audit your actual performance.
- Maintain a strict rule of no news trading.`

      let current = ''
      const words = fullText.split(' ')
      let i = 0
      
      const interval = setInterval(() => {
        if (i < words.length) {
          current += words[i] + ' '
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

    try {
      // 1. Create chat if none selected
      let chatId = selectedChatId
      if (!chatId) {
        const response = await fetch('/api/v1/ai/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: promptToSend.slice(0, 40) + '...',
            accounts: selectedAccounts,
            dateRange: selectedDateRange,
            customFrom: selectedDateRange === 'custom' ? customFromDate : null,
            customTo: selectedDateRange === 'custom' ? customToDate : null,
            dataSources: sourceOverride || selectedSources
          })
        })

        if (!response.ok) {
          const payload = await response.json()
          toast.error(payload.error || 'Failed to start conversation.')
          setIsSending(false)
          return
        }

        const payload = await response.json()
        const createdChat = payload.data
        setChats(prev => [createdChat, ...prev])
        chatId = createdChat.id
        setSelectedChatId(chatId)
      }

      // Add user message locally first
      const userMsg: ChatMessage = {
        id: `local-u-${Date.now()}`,
        role: 'user',
        content: promptToSend,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, userMsg])

      // 2. Stream AI message response
      const response = await fetch(`/api/v1/ai/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToSend })
      })

      if (!response.ok) {
        const payload = await response.json()
        if (response.status === 412 && payload.code === 'AI_DATA_CONSENT_REQUIRED') {
          setAiConsentGranted(false)
          setPendingPrompt({
            prompt: promptToSend,
            ...(sourceOverride ? { sources: sourceOverride } : {}),
          })
          setIsConsentDialogOpen(true)
        }
        toast.error(payload.error || 'Failed to send message.')
        setIsSending(false)
        return
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantResponse = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          
          // Parse Vercel AI SDK text protocol (e.g. 0:"text chunk")
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2))
                assistantResponse += text
                setStreamingText(assistantResponse)
              } catch {
                continue
              }
            }
          }
        }
      }

      // Reload chat messages from backend to get official saved ids
      const reloadRes = await fetch(`/api/v1/ai/chats/${chatId}`)
      if (reloadRes.ok) {
        const payload = await reloadRes.json()
        setMessages(payload.data?.messages || [])
      }

      setStreamingText('')
      
      // Update chat title if it was a new chat
      await fetch('/api/v1/ai/chats')
        .then(res => res.json())
        .then(payload => {
          if (payload.success) setChats(payload.data)
        })

    } catch (err) {
      toast.error('An error occurred during response transmission.')
    } finally {
      setIsSending(false)
    }
  }

  // Manage Chat Actions
  const handleTogglePin = async (chat: ChatSession) => {
    if (isDemoMode) {
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isPinned: !c.isPinned } : c))
      toast.success(chat.isPinned ? 'Chat unpinned' : 'Chat pinned')
      return
    }

    try {
      const response = await fetch(`/api/v1/ai/chats/${chat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !chat.isPinned })
      })
      if (response.ok) {
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isPinned: !chat.isPinned } : c))
        toast.success(chat.isPinned ? 'Chat unpinned' : 'Chat pinned')
      }
    } catch {
      toast.error('Failed to pin chat.')
    }
  }

  const handleToggleArchive = async (chat: ChatSession) => {
    if (isDemoMode) {
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isArchived: !c.isArchived } : c))
      toast.success(chat.isArchived ? 'Chat restored' : 'Chat archived')
      return
    }

    try {
      const response = await fetch(`/api/v1/ai/chats/${chat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !chat.isArchived })
      })
      if (response.ok) {
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isArchived: !chat.isArchived } : c))
        toast.success(chat.isArchived ? 'Chat restored' : 'Chat archived')
        if (selectedChatId === chat.id) {
          setSelectedChatId(null)
          setMessages([])
        }
      }
    } catch {
      toast.error('Failed to archive chat.')
    }
  }

  // Delete with confirmation
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
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (selectedChatId === chatId) {
        setSelectedChatId(null)
        setMessages([])
      }
      toast.success('Chat deleted')
      return
    }

    try {
      const response = await fetch(`/api/v1/ai/chats/${chatId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setChats(prev => prev.filter(c => c.id !== chatId))
        if (selectedChatId === chatId) {
          setSelectedChatId(null)
          setMessages([])
        }
        toast.success('Conversation deleted')
      } else {
        toast.error('Failed to delete chat.')
      }
    } catch {
      toast.error('Failed to delete chat.')
    }
  }

  const handleRenameChat = async (chatId: string) => {
    if (!renameValue.trim()) return

    if (isDemoMode) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: renameValue } : c))
      setIsRenameMode(false)
      toast.success('Chat renamed')
      return
    }

    try {
      const response = await fetch(`/api/v1/ai/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue })
      })
      if (response.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: renameValue } : c))
        setIsRenameMode(false)
        toast.success('Chat renamed')
      }
    } catch {
      toast.error('Failed to rename chat.')
    }
  }

  // Saved Insights Actions
  const handleSaveInsight = async (msg: ChatMessage) => {
    if (isDemoMode) {
      const newInsight: SavedInsight = {
        id: `insight-${Date.now()}`,
        title: 'Key AI Insight',
        content: msg.content,
        category: 'insight',
        createdAt: new Date().toISOString()
      }
      setSavedInsights(prev => [newInsight, ...prev])
      toast.success('Insight saved to library!')
      return
    }

    try {
      const response = await fetch('/api/v1/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'AI Analysis: ' + new Date().toLocaleDateString(),
          content: msg.content,
          category: 'insight'
        })
      })

      if (response.ok) {
        const payload = await response.json()
        setSavedInsights(prev => [payload.data, ...prev])
        toast.success('Insight saved to library!')
      }
    } catch {
      toast.error('Failed to save insight.')
    }
  }

  const handleDeleteInsight = async (insightId: string) => {
    if (isDemoMode) {
      setSavedInsights(prev => prev.filter(i => i.id !== insightId))
      toast.success('Insight removed')
      return
    }

    try {
      const response = await fetch(`/api/v1/ai/insights/${insightId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setSavedInsights(prev => prev.filter(i => i.id !== insightId))
        toast.success('Insight removed')
      }
    } catch {
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

  // Get Suggested Follow Ups based on messages length and context
  const getFollowUps = () => {
    if (messages.length === 0) return []
    // Look at last user message content to suggest category
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
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiSettings: {
            ...aiSettings,
            dataProcessingConsentAt: consentAt,
            dataProcessingConsentVersion: AI_DATA_CONSENT_VERSION,
          },
        }),
      })
      if (!response.ok) throw new Error('Consent update failed')

      const nextSettings = {
        ...aiSettings,
        dataProcessingConsentAt: consentAt,
        dataProcessingConsentVersion: AI_DATA_CONSENT_VERSION,
      }
      const request = pendingPrompt
      setAiSettings(nextSettings)
      setAiConsentGranted(true)
      setPendingPrompt(null)
      setIsConsentDialogOpen(false)
      await handleStartChat(request.prompt, request.sources, true)
    } catch {
      toast.error('Could not save your AI data preference.')
    } finally {
      setIsSavingConsent(false)
    }
  }

  if (paywallError) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Brain className="h-6 w-6" />
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
          handleStartChat(`Summarize and expand on my weekly analysis: ${review.summary || 'Review this weekly audit.'}`)
        }}
      />

      {!sidebarCollapsed && (
        <WorkspaceSidebar
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

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isDemoMode && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-[hsl(var(--surface-subtle))] px-4 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" /><span><strong className="text-foreground">Demo data.</strong> Responses are examples, not analysis of a connected account.</span></p>
            <Button size="sm" asChild><Link href="/subscribe">Upgrade</Link></Button>
          </div>
        )}

        <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-border/70 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {sidebarCollapsed && <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)} aria-label="Open workspace library"><PanelLeft /></Button>}
            {selectedChatId ? (
              isRenameMode ? (
                <div className="flex min-w-0 items-center gap-1">
                  <label className="sr-only" htmlFor="conversation-title">Conversation title</label>
                  <input id="conversation-title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleRenameChat(selectedChatId)} autoFocus className="h-10 min-w-0 max-w-72 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring" />
                  <Button variant="ghost" size="icon" onClick={() => handleRenameChat(selectedChatId)} aria-label="Save conversation title"><Check /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsRenameMode(false)} aria-label="Cancel rename"><X /></Button>
                </div>
              ) : (
                <>
                  <Brain className="h-4 w-4 shrink-0" />
                  <h1 className="truncate text-sm font-semibold">{currentChat?.title || 'Active conversation'}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="touch-target-compact h-8 w-8"
                    onClick={() => {
                      setRenameValue(currentChat?.title || '')
                      setIsRenameMode(true)
                    }}
                    aria-label="Rename conversation"
                  >
                    <Edit3 />
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
            <Button variant="outline" size="sm" onClick={() => {
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
      </main>
    </div>
  )
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}
