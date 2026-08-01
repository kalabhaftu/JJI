const SAMPLE_TRADE_HEADERS = [
  'Symbol',
  'Side',
  'Quantity',
  'Entry Price',
  'Close Price',
  'Entry Date',
  'Close Date',
  'PnL',
]

const SAMPLE_TRADE_ROWS = [
  ['EURUSD', 'Buy', '1.0', '1.0850', '1.0900', '2026-06-08 09:00:00', '2026-06-08 10:00:00', '500.00'],
  ['GBPUSD', 'Sell', '1.5', '1.2650', '1.2600', '2026-06-08 10:30:00', '2026-06-08 12:00:00', '750.00'],
  ['USDJPY', 'Buy', '2.0', '155.20', '154.80', '2026-06-08 13:00:00', '2026-06-08 14:15:00', '-800.00'],
]

export function downloadSampleTradesCsv() {
  const csv = [
    SAMPLE_TRADE_HEADERS.join(','),
    ...SAMPLE_TRADE_ROWS.map((row) => row.join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample_trades.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
