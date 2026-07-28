export const CacheKeys = {
  // User Cache Version key for instant atomic invalidation
  userVersion:     (userId: string)                    => `v1:user-ver:${userId}`,

  // Account-level metrics - invalidated on any trade mutation
  accountMetrics:  (accountId: string, version?: number | string) => version ? `v1:metrics:${accountId}:v:${version}` : `v1:metrics:${accountId}`,
  tradeStats:      (accountId: string, version?: number | string) => version ? `v1:stats:${accountId}:v:${version}` : `v1:stats:${accountId}`,

  // Chart & Trade List data - versioned and short TTL
  tradeList:       (userId: string, version: number | string, paramsHash: string) => `v1:u:${userId}:v:${version}:trades:${paramsHash}`,
  dailyPnlSeries:  (accountId: string, from: string, to: string) => `v1:pnl:${accountId}:${from}:${to}`,
  equityCurve:     (accountId: string, from: string, to: string) => `v1:equity:${accountId}:${from}:${to}`,
  drawdownCurve:   (accountId: string, from: string, to: string) => `v1:dd:${accountId}:${from}:${to}`,
  widgetData:      (userId: string, type: string, params: string, version?: number | string) => version ? `v1:widget:${userId}:v:${version}:${type}:${params}` : `v1:widget:${userId}:${type}:${params}`,

  // Prop firm state - invalidated on breach or phase change
  propFirmPhase:   (accountId: string)                 => `v1:phase:${accountId}`,
  propFirmWidgetMetrics: (accountId: string, timezone: string, version: string) => `v1:prop-widget:${accountId}:${timezone.replace(/[^A-Za-z0-9_-]/g, '_')}:${version}`,
  propFirmPayload: (accountId: string, version: number | string) => `v1:prop-payload:${accountId}:v:${version}`,
  dailyAnchor:     (accountId: string, date: string)   => `v1:anchor:${accountId}:${date}`,

  // User-level - invalidated on account changes
  userAccounts:    (userId: string)                    => `v1:accounts:${userId}`,
} as const

// All TTLs in seconds
export const CacheTTL = {
  accountMetrics: 60 * 15,       // 15 minutes
  tradeStats:     60 * 15,       // 15 minutes
  tradeList:      60 * 15,       // 15 minutes
  dailyPnlSeries: 60 * 30,       // 30 minutes
  equityCurve:    60 * 30,       // 30 minutes
  drawdownCurve:  60 * 30,       // 30 minutes
  widgetData:     60 * 30,       // 30 minutes
  propFirmPhase:  60 * 5,        // 5 minutes
  propFirmWidgetMetrics: 60,      // 1 minute, compact derived metrics
  propFirmPayload: 60 * 15,      // 15 minutes
  dailyAnchor:    60 * 60 * 23,  // 23 hours (reset slightly before cron)
  userAccounts:   60 * 5,        // 5 minutes
} as const
