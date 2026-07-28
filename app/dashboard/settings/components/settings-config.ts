export const timezones = [
  'UTC',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

export const defaultAiSettings = {
  autoGenerateInsights: false,
  includeAiInsightsInNotifications: false,
}

export function buildTradingViewWebhookExample(token: string | null) {
  return JSON.stringify({
    token: token || 'your_webhook_token',
    symbol: 'EURUSD',
    side: 'BUY',
    entry_price: 1.085,
    close_price: 1.092,
    quantity: 0.1,
    pnl: 70,
    entry_time: '2026-05-07T14:30:00Z',
    close_time: '2026-05-07T18:45:00Z',
    stop_loss: 1.08,
    take_profit: 1.095,
    comment: 'Imported via TradingView alert',
  }, null, 2)
}
