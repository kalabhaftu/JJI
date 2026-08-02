const INDICES_ALIASES: Record<string, string> = {
  'US100': 'US100',
  'NAS100': 'US100',
  'NASDAQ100': 'US100',
  'NASDAQ': 'US100',
  'USTECH': 'US100',
  'NAS': 'US100',
  'NQ': 'US100',

  'DJ30': 'US30',
  'DOWJONES': 'US30',
  'WALLST30': 'US30',
  'YM': 'US30',

  'SP500': 'US500',
  'S&P500': 'US500',
  'SPX500': 'US500',
  'SPX': 'US500',
  'ES': 'US500',

  'DAX40': 'GER40',
  'DE40': 'GER40',
  'GER30': 'GER40',
  'DAX': 'GER40',
  'FDAX': 'GER40',

  'FTSE100': 'UK100',
  'FTSE': 'UK100',
  'UKX': 'UK100',
  'Z': 'UK100',

  'NIKKEI225': 'JP225',
  'JPN225': 'JP225',
  'NI225': 'JP225'
}

const COMMODITIES_ALIASES: Record<string, string> = {
  'XAU': 'XAUUSD',
  'GOLD': 'XAUUSD',
  'GC': 'XAUUSD',
  'XAU/USD': 'XAUUSD',

  'XAG': 'XAGUSD',
  'SILVER': 'XAGUSD',
  'SI': 'XAGUSD',

  'WTI': 'USOIL',
  'CL': 'USOIL',
  'OIL.WTI': 'USOIL',

  'BRENT': 'UKOIL',
  'BRN': 'UKOIL',
  'OIL.BRENT': 'UKOIL'
}

const FOREX_ALIASES: Record<string, string> = {
  'EUR/USD': 'EURUSD',
  'EUR-USD': 'EURUSD',

  'GBP/USD': 'GBPUSD',
  'GBP-USD': 'GBPUSD',
  'CABLE': 'GBPUSD',

  'USD/JPY': 'USDJPY',
  'USD-JPY': 'USDJPY',

  'EURGBP': 'EUR/GBP',
  'EUR/GBP': 'EUR/GBP',
  'GBPCHF': 'GBP/CHF',
  'GBP/CHF': 'GBP/CHF',
  'AUDUSD': 'AUD/USD',
  'AUD/USD': 'AUD/USD',
  'USDCAD': 'USD/CAD',
  'USD/CAD': 'USD/CAD',
  'NZDUSD': 'NZD/USD',
  'NZD/USD': 'NZD/USD',
  'USDCHF': 'USD/CHF',
  'USD/CHF': 'USD/CHF',
  'CADJPY': 'CAD/JPY',
  'CAD/JPY': 'CAD/JPY',
  'GBPJPY': 'GBP/JPY',
  'GBP/JPY': 'GBP/JPY',
  'EURJPY': 'EUR/JPY',
  'EUR/JPY': 'EUR/JPY'
}

const CRYPTO_ALIASES: Record<string, string> = {
  'BTC/USD': 'BTCUSD',
  'BTC-USD': 'BTCUSD',
  'XBTUSD': 'BTCUSD',
  'BTCUSDT': 'BTCUSD',

  'ETH/USD': 'ETHUSD',
  'ETH-USD': 'ETHUSD',
  'ETHUSDT': 'ETHUSD',

  'BTCUSDC': 'BTC/USD',
  'ETHUSDC': 'ETH/USD'
}

const ASSET_ALIASES: Record<string, string> = {
  ...INDICES_ALIASES,
  ...COMMODITIES_ALIASES,
  ...FOREX_ALIASES,
  ...CRYPTO_ALIASES
}

function getCanonicalAssetName(searchTerm: string): string {
  const upperSearchTerm = searchTerm.toUpperCase()
  return ASSET_ALIASES[upperSearchTerm] || searchTerm
}

export function getAssetSearchTerms(canonicalName: string): string[] {
  const upperCanonical = canonicalName.toUpperCase()
  const aliases = Object.entries(ASSET_ALIASES)
    .filter(([, canonical]) => canonical.toUpperCase() === upperCanonical)
    .map(([alias]) => alias)

  return [canonicalName, ...aliases]
}

function isAssetMatch(searchTerm: string, assetName: string): boolean {
  const canonicalName = getCanonicalAssetName(searchTerm)
  const searchTerms = getAssetSearchTerms(assetName)

  return searchTerms.some(term =>
    term.toUpperCase().includes(canonicalName.toUpperCase()) ||
    canonicalName.toUpperCase().includes(term.toUpperCase())
  )
}

function getAssetCategory(assetName: string): string {
  const upperName = assetName.toUpperCase()

  if (Object.keys(INDICES_ALIASES).some(alias => alias === upperName)) {
    return 'Indices'
  }
  if (Object.keys(COMMODITIES_ALIASES).some(alias => alias === upperName)) {
    return 'Commodities'
  }
  if (Object.keys(FOREX_ALIASES).some(alias => alias === upperName)) {
    return 'Forex'
  }
  if (Object.keys(CRYPTO_ALIASES).some(alias => alias === upperName)) {
    return 'Crypto'
  }

  return 'Other'
}

function getAssetAliasGroups() {
  return {
    indices: Object.keys(INDICES_ALIASES),
    commodities: Object.keys(COMMODITIES_ALIASES),
    forex: Object.keys(FOREX_ALIASES),
    crypto: Object.keys(CRYPTO_ALIASES)
  }
}


const testAliases = () => {

  const testCases = [
    { input: 'NQ', expected: 'NAS100' },
    { input: 'USTECH', expected: 'NAS100' },
    { input: 'YM', expected: 'US30' },
    { input: 'ES', expected: 'US500' },
    { input: 'GOLD', expected: 'XAUUSD' },
    { input: 'SILVER', expected: 'XAGUSD' },
    { input: 'WTI', expected: 'USOIL' },
    { input: 'BRENT', expected: 'UKOIL' },
    { input: 'Z', expected: 'UK100' },
    { input: 'DAX', expected: 'GER40' }
  ]

  testCases.forEach(({ input, expected }) => {
    const result = getCanonicalAssetName(input)
  })

}
