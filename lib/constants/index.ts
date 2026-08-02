export const CACHE_DURATION_SHORT = 30 * 1000
export const CACHE_DURATION_MEDIUM = 60 * 1000
const CACHE_DURATION_LONG = 5 * 60 * 1000
const CACHE_DURATION_EXTRA_LONG = 15 * 60 * 1000
export const API_TIMEOUT = 10 * 1000
const DEBOUNCE_DELAY = 300
const DEBOUNCE_DELAY_SHORT = 150
const DEBOUNCE_DELAY_LONG = 500
const DEFAULT_PAGE_SIZE = 50
const LARGE_PAGE_SIZE = 100
const SMALL_PAGE_SIZE = 20
const MIN_REFRESH_INTERVAL = 2 * 1000
const MAX_REFRESH_INTERVAL = 15 * 1000
const RECONNECT_DELAY = 5 * 1000
const MAX_RECONNECT_ATTEMPTS = 5
export const MAX_RETRY_ATTEMPTS = 3
export const RETRY_BASE_DELAY = 1000
export const RETRY_MULTIPLIER = 2
export const MAX_CACHE_ITEMS = 1000
const MAX_TRADES_BATCH = 500
const TRADES_WARNING_THRESHOLD = 5000

const TIMEFRAME_OPTIONS = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: 'd', label: 'Daily' },
  { value: 'w', label: 'Weekly' },
  { value: 'm', label: 'Monthly' },
] as const

export const MARKET_BIAS_OPTIONS = [
  { value: 'BULLISH', label: 'Bullish', activeClass: 'bg-long/10 border-long/20 text-long' },
  { value: 'BEARISH', label: 'Bearish', activeClass: 'bg-short/10 border-short/20 text-short' },
  { value: 'UNDECIDED', label: 'Neutral', activeClass: 'bg-muted border-primary/50 text-foreground' }
] as const

export const YAHOO_FINANCE_SYMBOL_MAP: Record<string, string> = {
  'NQ': 'NQ=F', 'NAS100': 'NQ=F', 'US100': 'NQ=F',
  'ES': 'ES=F', 'US500': 'ES=F', 'SPX500': 'ES=F',
  'YM': 'YM=F', 'US30': 'YM=F', 'DJI': 'YM=F',
  'RTY': 'RTY=F', 'US2000': 'RTY=F',
  'CL': 'CL=F', 'USOIL': 'CL=F', 'WTI': 'CL=F',
  'GC': 'GC=F', 'GOLD': 'GC=F', 'XAUUSD': 'GC=F',
  'BTC': 'BTC-USD', 'ETH': 'ETH-USD'
}

export const FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD']

export const CHART_COLORS = {
  UP: 'hsl(var(--chart-profit))',
  DOWN: 'hsl(var(--chart-loss))',
  BG: 'transparent',
  TEXT: 'hsl(var(--muted-foreground))',
  GRID: 'hsl(var(--border) / 0.1)',
  CROSSHAIR: 'hsl(var(--primary))',
}
