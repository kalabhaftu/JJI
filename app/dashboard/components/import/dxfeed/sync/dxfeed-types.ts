export interface DxFeedLoginRequest {
  login: string
  password: string
  environment: number
  version: number
  withDetails: boolean
  connectOnlyTrading: boolean
}

export interface DxFeedLoginResponse {
  status: string
  token?: string
  reason?: string
  details?: string[]
  tradingWss?: string
  tradingWssEndpoint?: string
  tradingRestReportHost?: string
  tradingRestReportToken?: string
  propfirmName?: string
  tradingApiVersion?: number
}


export interface DxFeedStoredCredentials {
  accessToken: string
  historicalHost: string
  accountNumbers?: string[]
}

export interface DxFeedTradingAccount {
  accountId: number
  accountReference: string | null
  accountHeader: string | null
}

export interface DxFeedAccountListResponse {
  success: boolean
  data: DxFeedTradingAccount[] | null
}

interface DxFeedContractDetail {
  symbolId: number
  symbol: string | null
  exchange: string | null
  contractName: string | null
  tradableQuantityFractionable: number
  tradableQuantityMinimum: number
}

export interface DxFeedReportTrade {
  tradeId: number
  contract: DxFeedContractDetail | null
  contractId: number
  entryDate: number
  exitDate: number
  quantity: number
  entryPrice: number
  exitPrice: number
  grossPl: number
  netPl: number
  convertedGrossPl: number
  convertedNetPl: number
  overnight: boolean
  overweekend: boolean
  isCloseTrade: boolean
  maxQuantity: number | null
  tradePl: number | null
  convertedTradePl: number | null
  maxDrawdown: number | null
  maxRunup: number | null
  currency: string | null
}

export interface DxFeedTradesResponse {
  success: boolean
  data: DxFeedReportTrade[] | null
}

interface DxFeedTradesMultiAccountResponse {
  success: boolean
  data: {
    accountId: number
    accountReference: string | null
    accountHeader: string | null
    data: DxFeedReportTrade[] | null
  } | null
}

export interface DxFeedTradesResult {
  processedTrades?: typeof import('@/lib/db/schema').Trade.$inferSelect[]
  savedCount?: number
  tradesCount?: number
  error?: string
}
