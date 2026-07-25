export const CacheKeys = {
  // Account-level metrics - invalidated on any trade mutation
  accountMetrics:  (accountId: string)                 => `v1:metrics:${accountId}`,
  tradeStats:      (accountId: string)                 => `v1:stats:${accountId}`,

  // Chart data - invalidated on trade mutation, short TTL
  dailyPnlSeries:  (accountId: string, from: string, to: string) => `v1:pnl:${accountId}:${from}:${to}`,
  equityCurve:     (accountId: string, from: string, to: string) => `v1:equity:${accountId}:${from}:${to}`,
  drawdownCurve:   (accountId: string, from: string, to: string) => `v1:dd:${accountId}:${from}:${to}`,
  widgetData:      (userId: string, type: string, params: string) => `v1:widget:${userId}:${type}:${params}`,

  // Prop firm state - invalidated on breach or phase change
  propFirmPhase:   (accountId: string)                 => `v1:phase:${accountId}`,
  dailyAnchor:     (accountId: string, date: string)   => `v1:anchor:${accountId}:${date}`,

  // User-level - invalidated on account changes
  userAccounts:    (userId: string)                    => `v1:accounts:${userId}`,
} as const

// All TTLs in seconds
export const CacheTTL = {
  accountMetrics: 60 * 15,       // 15 minutes
  tradeStats:     60 * 15,       // 15 minutes
  dailyPnlSeries: 60 * 30,       // 30 minutes
  equityCurve:    60 * 30,       // 30 minutes
  drawdownCurve:  60 * 30,       // 30 minutes
  widgetData:     60 * 30,       // 30 minutes
  propFirmPhase:  60 * 5,        // 5 minutes
  dailyAnchor:    60 * 60 * 23,  // 23 hours (reset slightly before cron)
  userAccounts:   60 * 5,        // 5 minutes
} as const
