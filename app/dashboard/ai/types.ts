import type { HugeiconsIconProps } from '@hugeicons/react'

export type WorkspaceTab = 'chats' | 'insights' | 'history'

export interface ChatSession {
  id: string
  title: string
  isPinned: boolean
  isArchived: boolean
  accounts: string[]
  dateRange: string
  customFrom: string | null
  customTo: string | null
  dataSources: string[]
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface SavedInsight {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
}

export interface WeeklyReview {
  weekStart?: string
  summary?: string
  grade?: string
  riskGrade?: string
  consistencyScore?: string | number
  stats?: { consistencyScore?: string | number; topPriorityFix?: string }
  highlights?: string[]
  strengths?: string[]
  lowlights?: string[]
  weaknesses?: string[]
  recommendations?: string[]
  focusNextWeek?: string
  performanceInsights?: string[]
  topPriorityFix?: string
  emotionalPatterns?: string[]
}

export interface AnalysisTemplate {
  id: string
  title: string
  icon: HugeiconsIconProps['icon']
  description: string
  prompt: string
  dataSources: string[]
}

export interface WorkspaceAccount {
  id: string
  displayName?: string | null
  name?: string | null
  number?: string | null
  propfirm?: string | null
  broker?: string | null
}
