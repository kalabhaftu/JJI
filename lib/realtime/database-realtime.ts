'use client'

import { createClient } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import logger from '@/lib/logger';
import { reportError } from '@/lib/observability/report-error'
import type { ChangeEvent, DatabaseChange, RealtimeSession, RealtimeStatus, RealtimeTable } from './types'

export type { ChangeEvent, DatabaseChange, RealtimeSession, RealtimeStatus, RealtimeTable } from './types'

const REALTIME_TABLES = ['Trade', 'Account', 'MasterAccount', 'PhaseAccount', 'Payout', 'DailyNote', 'Notification', 'Synchronization'] as const
const TABLES_WITH_USER_ID_FILTER = new Set<RealtimeTable>(['Trade', 'Account', 'MasterAccount', 'DailyNote', 'Notification', 'Synchronization'])

type ChangeCallback = (change: DatabaseChange) => void

export interface SubscriptionOptions {
  tables: readonly RealtimeTable[]
  userId: string
  onChange: ChangeCallback
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error') => void
}

export function normalizeDatabaseChange(
  table: RealtimeTable,
  payload: Pick<RealtimePostgresChangesPayload<Record<string, unknown>>, 'eventType' | 'new' | 'old'>,
  session: RealtimeSession,
): DatabaseChange {
  return {
    table,
    event: payload.eventType as ChangeEvent,
    newRecord: payload.new as Record<string, unknown> | null,
    oldRecord: payload.old as Record<string, unknown> | null,
    timestamp: new Date(),
    session,
  }
}

export class DatabaseRealtimeManager {
  private channel: RealtimeChannel | null = null
  private isConnected = false
  private userId: string | null = null
  private callbacks: Set<ChangeCallback> = new Set()
  private statusCallbacks: Set<(status: 'connected' | 'disconnected' | 'error') => void> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private hasLoggedReconnectExhausted = false
  private generation = 0
  private readonly clientFactory: typeof createClient

  constructor(clientFactory: typeof createClient = createClient) {
    this.clientFactory = clientFactory
  }


  subscribe(options: SubscriptionOptions): () => void {
    const { tables, userId, onChange, onStatusChange } = options
    
    if (this.userId !== userId) {
      this.disconnect()
      this.generation++
      this.reconnectAttempts = 0
      this.hasLoggedReconnectExhausted = false
      this.callbacks.clear()
      this.statusCallbacks.clear()
    }
    this.userId = userId
    this.callbacks.add(onChange)
    if (onStatusChange) {
      this.statusCallbacks.add(onStatusChange)
    }

    if (!this.isConnected && !this.channel) {
      this.connect(tables, userId, this.generation)
    }

    return () => {
      this.callbacks.delete(onChange)
      if (onStatusChange) {
        this.statusCallbacks.delete(onStatusChange)
      }
      
      if (this.callbacks.size === 0) {
        this.disconnect()
      }
    }
  }
  
  private async connect(tables: readonly RealtimeTable[], userId: string, generation: number) {
    try {
      const supabase = this.clientFactory()

      if (!supabase.channel || typeof supabase.channel !== 'function') {
        logger.warn('[Realtime] Supabase client does not support realtime')
        return
      }
      
      if (this.channel && this.isCurrentSession(userId, generation)) {
        try {
          this.channel.unsubscribe()
        } catch (e) {

        }
        this.channel = null
      }
      
      const channelName = `db-changes-${userId}-${Date.now()}`
      let channel = supabase.channel(channelName, {
        config: {

          presence: {
            key: userId
          }
        }
      })
      
      for (const table of tables) {
        try {
          const shouldFilterByUserId = TABLES_WITH_USER_ID_FILTER.has(table)
          const postgresChangeConfig: {
            event: '*'
            schema: 'public'
            table: RealtimeTable
            filter?: string
          } = {
            event: '*',
            schema: 'public',
            table
          }

          if (shouldFilterByUserId) {
            postgresChangeConfig.filter = `userId=eq.${userId}`
          }

          channel = channel.on(
            'postgres_changes',
            postgresChangeConfig,
            (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
              if (this.isCurrentSession(userId, generation) && this.channel === channel) {
                this.handleChange(table, payload, { userId, generation })
              }
            }
          )
        } catch (tableError) {

          logger.warn(tableError instanceof Error ? tableError : new Error('Unknown error'), `[Realtime] Failed to subscribe to table ${table}:`)
        }
      }
      
      if (!this.isCurrentSession(userId, generation)) {
        await channel.unsubscribe()
        return
      }
      this.channel = channel
      

      channel.subscribe((status: string, err?: Error) => {
        if (!this.isCurrentSession(userId, generation) || this.channel !== channel) return
        if (status === 'SUBSCRIBED') {
          this.isConnected = true
          this.reconnectAttempts = 0
          this.hasLoggedReconnectExhausted = false
          this.notifyStatus('connected')
        } else if (status === 'CHANNEL_ERROR') {
          this.isConnected = false
          this.notifyStatus('error')

          if (err && err.message) {
            logger.warn({ err: new Error(err.message) }, '[Realtime] Channel error:')
          } else {
            logger.warn({ err: new Error('Connection issue') }, '[Realtime] Channel error:')
          }
          this.scheduleReconnect(tables, userId, generation)
        } else if (status === 'TIMED_OUT') {
          this.isConnected = false
          this.notifyStatus('disconnected')
          this.scheduleReconnect(tables, userId, generation)
        } else if (status === 'CLOSED') {
          this.isConnected = false
          this.notifyStatus('disconnected')
        }
      })
      
    } catch (error) {
      if (!this.isCurrentSession(userId, generation)) return

      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
      logger.warn({ err: new Error(errorMessage) }, '[Realtime] Failed to connect:')
      this.notifyStatus('error')

      this.scheduleReconnect(tables, userId, generation)
    }
  }
  
  private handleChange(
    table: RealtimeTable, 
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    session: RealtimeSession,
  ) {
    const change = normalizeDatabaseChange(table, payload, session)
    
    for (const callback of this.callbacks) {
      try {
        callback(change)
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'dispatch-realtime-change',
          tags: { table },
        })
      }
    }
  }
  
  private notifyStatus(status: 'connected' | 'disconnected' | 'error') {
    for (const callback of this.statusCallbacks) {
      try {
        callback(status)
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'dispatch-realtime-status',
          tags: { status },
        })
      }
    }
  }
  
  private scheduleReconnect(tables: readonly RealtimeTable[], userId: string, generation: number) {
    if (!this.isCurrentSession(userId, generation)) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (!this.hasLoggedReconnectExhausted) {
        logger.warn('[Realtime] Max reconnect attempts reached; realtime paused until a later reconnect opportunity')
        this.hasLoggedReconnectExhausted = true
      }
      this.notifyStatus('error')
      return
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++
    
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.isCurrentSession(userId, generation)) {
        this.disconnect()
        void this.connect(tables, userId, generation)
      }
    }, delay)
  }
  
  private disconnect() {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    this.isConnected = false
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  private isCurrentSession(userId: string, generation: number) {
    return this.userId === userId && this.generation === generation
  }

  getChannelForTest() {
    return this.channel
  }


  getStatus(): { isConnected: boolean; subscriberCount: number } {
    return {
      isConnected: this.isConnected,
      subscriberCount: this.callbacks.size
    }
  }


  reconnect() {
    if (this.userId) {
      this.disconnect()
      this.reconnectAttempts = 0
      void this.connect(REALTIME_TABLES, this.userId, this.generation)
    }
  }
}

const DatabaseRealtime = new DatabaseRealtimeManager()


export function useDatabaseRealtime(options: {
  userId: string | undefined
  enabled?: boolean
  onTradeChange?: (change: DatabaseChange) => void
  onAccountChange?: (change: DatabaseChange) => void
  onNotificationChange?: (change: DatabaseChange) => void
  onSynchronizationChange?: (change: DatabaseChange) => void
  onAnyChange?: (change: DatabaseChange) => void
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error') => void
}) {
  const { useEffect, useRef, useCallback } = require('react')
  
  const {
    userId,
    enabled = true,
    onTradeChange,
    onAccountChange,
    onNotificationChange,
    onSynchronizationChange,
    onAnyChange,
    onStatusChange
  } = options
  
  const onTradeChangeRef = useRef(onTradeChange)
  const onAccountChangeRef = useRef(onAccountChange)
  const onNotificationChangeRef = useRef(onNotificationChange)
  const onSynchronizationChangeRef = useRef(onSynchronizationChange)
  const onAnyChangeRef = useRef(onAnyChange)
  const onStatusChangeRef = useRef(onStatusChange)
  
  useEffect(() => {
    onTradeChangeRef.current = onTradeChange
    onAccountChangeRef.current = onAccountChange
    onNotificationChangeRef.current = onNotificationChange
    onSynchronizationChangeRef.current = onSynchronizationChange
    onAnyChangeRef.current = onAnyChange
    onStatusChangeRef.current = onStatusChange
  }, [onTradeChange, onAccountChange, onNotificationChange, onSynchronizationChange, onAnyChange, onStatusChange])
  
  const handleChange = useCallback((change: DatabaseChange) => {
    if (change.table === 'Trade' && onTradeChangeRef.current) {
      onTradeChangeRef.current(change)
    }
    if (['Account', 'MasterAccount', 'PhaseAccount', 'Payout'].includes(change.table) && onAccountChangeRef.current) {
      onAccountChangeRef.current(change)
    }
    if (change.table === 'Notification' && onNotificationChangeRef.current) {
      onNotificationChangeRef.current(change)
    }
    if (change.table === 'Synchronization' && onSynchronizationChangeRef.current) {
      onSynchronizationChangeRef.current(change)
    }
    
    if (onAnyChangeRef.current) {
      onAnyChangeRef.current(change)
    }
  }, [])
  
  const handleStatusChange = useCallback((status: 'connected' | 'disconnected' | 'error') => {
    if (onStatusChangeRef.current) {
      onStatusChangeRef.current(status)
    }
  }, [])
  
  useEffect(() => {
    if (!enabled || !userId) return

    const unsubscribe = DatabaseRealtime.subscribe({
      tables: [...REALTIME_TABLES],
      userId,
      onChange: handleChange,
      onStatusChange: handleStatusChange
    })

    return unsubscribe
  }, [enabled, userId, handleChange, handleStatusChange])
}

export default DatabaseRealtime
