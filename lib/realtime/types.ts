export type RealtimeTable = 'Trade' | 'Account' | 'MasterAccount' | 'PhaseAccount' | 'Payout' | 'DailyNote' | 'Notification' | 'Synchronization'
export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'degraded' | 'error'

export interface RealtimeSession {
  userId: string
  generation: number
}

export interface DatabaseChange {
  table: RealtimeTable
  event: ChangeEvent
  newRecord: Record<string, unknown> | null
  oldRecord: Record<string, unknown> | null
  timestamp: Date
  session: RealtimeSession
}
