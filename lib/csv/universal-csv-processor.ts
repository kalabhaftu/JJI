

import type { TradeType } from '@/lib/db/schema/trades';

import { generateTradeHash } from '@/lib/trading/trade-grouping'
import { calculateTradeDuration } from '@/lib/time-utils'

export interface ProcessingResult {
  success: boolean
  trades: Partial<TradeType>[]
  warnings: ProcessingWarning[]
  errors: ProcessingError[]
  detectedPlatform: string | null
  mappedFields: MappedFields
  missingRequiredFields: string[]
  stats: ProcessingStats
}

interface ProcessingWarning {
  row: number
  field: string
  message: string
}

interface ProcessingError {
  row: number
  message: string
  fatal: boolean
}

export interface ProcessingStats {
  totalRows: number
  processedRows: number
  skippedRows: number
  tradesWithStopLoss: number
  tradesWithTakeProfit: number
  tradesWithCommission: number
}

interface MappedFields {
  instrument: string | null
  side: string | null
  quantity: string | null
  entryPrice: string | null
  closePrice: string | null
  entryDate: string | null
  closeDate: string | null
  pnl: string | null
  commission: string | null
  stopLoss: string | null
  takeProfit: string | null
  swap: string | null
  timeInPosition: string | null
  ticket: string | null
}

const FIELD_MAPPINGS: Record<keyof MappedFields, string[]> = {
  instrument: [

    'symbol', 'instrument', 'ticker', 'asset', 'market', 'product', 'contract',

    'contractname', 'contract_name', 'symbole', 'pair', 'currency_pair',

    'symbole', 'instrument', 'marché',

    'sym', 'instr', 'underlying', 'security', 'stock', 'future', 'forex'
  ],
  side: [

    'side', 'type', 'direction', 'action', 'position', 'order_type', 'trade_type',

    'market pos.', 'pos. marché.', 'buysell', 'buy_sell', 'long_short',

    'b/s', 'bs', 'l/s', 'ls', 'trade_side', 'position_type', 'order_side'
  ],
  quantity: [

    'quantity', 'qty', 'size', 'volume', 'lots', 'contracts', 'shares', 'amount',

    'qté', 'original_position_size', 'position_size', 'trade_size', 'lot_size',

    'units', 'no_of_lots', 'num_contracts', 'trade_qty', 'filled_qty'
  ],
  entryPrice: [

    'entry_price', 'entryprice', 'open_price', 'openprice', 'opening_price', 'buy_price',

    'prix d\'entrée', 'entry price', 'fill_price', 'avg_entry', 'average_entry',

    'open', 'bought_price', 'buyprice', 'in_price', 'start_price', 'prix'
  ],
  closePrice: [

    'close_price', 'closeprice', 'exit_price', 'exitprice', 'closing_price', 'sell_price',

    'prix de sortie', 'close price', 'exit price', 'avg_exit', 'average_exit',

    'close', 'sold_price', 'sellprice', 'out_price', 'end_price', 'prix'
  ],
  entryDate: [

    'entry_date', 'entrydate', 'open_date', 'opendate', 'entry_time', 'entrytime',

    'opening_time_utc', 'open time', 'boughttimestamp', 'entered_at', 'enteredat',
    'heure d\'entrée', 'entry time', 'open_time', 'trade_open_time', 'ouvrir',

    'date_open', 'datetime_open', 'start_time', 'start_date', 'open_datetime'
  ],
  closeDate: [

    'close_date', 'closedate', 'exit_date', 'exitdate', 'close_time', 'closetime',

    'closing_time_utc', 'close time', 'soldtimestamp', 'exited_at', 'exitedat',
    'heure de sortie', 'exit time', 'close_time', 'trade_close_time', 'fermeture',

    'date_close', 'datetime_close', 'end_time', 'end_date', 'close_datetime'
  ],
  pnl: [

    'pnl', 'profit', 'p&l', 'profit_loss', 'profitloss', 'net_pnl', 'gross_pnl',

    'gross p&l', 'realized_pnl', 'realized_profit', 'net_profit', 'trade_result',
    'profit_usd', 'net_profit_usd', 'gross_profit_usd',

    'bénéfice', 'résultat',

    'gain', 'loss', 'return', 'pl', 'profit/loss', 'realized', 'net'
  ],
  commission: [

    'commission', 'fee', 'fees', 'commissions', 'trading_fee', 'broker_fee',

    'comm', 'commission_usd', 'order_fee', 'transaction_fee', 'brokerage',

    'cost', 'charges', 'expense', 'total_fee'
  ],
  stopLoss: [

    'stop_loss', 'stoploss', 'sl', 'stop', 'stop_price', 'stopprice',

    'stop loss', 's/l', 'stop-loss', 'protective_stop',

    'sl_price', 'slprice', 'stop_level', 'exit_stop'
  ],
  takeProfit: [

    'take_profit', 'takeprofit', 'tp', 'target', 'profit_target', 'target_price',

    'take profit', 't/p', 'take-profit', 'limit_price',

    'tp_price', 'tpprice', 'profit_level', 'exit_target'
  ],
  swap: [

    'swap', 'overnight', 'rollover', 'financing', 'interest',

    'swap_usd', 'swap_fee', 'overnight_fee', 'carry_cost',

    'funding', 'financing_cost'
  ],
  timeInPosition: [

    'duration', 'time_in_position', 'timeinposition', 'hold_time', 'holding_time',

    'durée du trade en secondes', 'trade_duration', 'position_duration',

    'time', 'elapsed', 'period', 'length'
  ],
  ticket: [

    'ticket', 'id', 'trade_id', 'tradeid', 'order_id', 'orderid', 'position_id',

    'deal_id', 'execution_id', 'reference', 'ref', 'buyfillid', 'sellfillid',
    'entry_name', 'exit_name', 'nom d\'entrée',

    'order_number', 'transaction_id', 'trade_number'
  ]
}

const LONG_VALUES = ['buy', 'long', 'b', 'l', 'call', 'bullish', '1', 'acheter', 'achat']
const SHORT_VALUES = ['sell', 'short', 's', 'put', 'bearish', '-1', '0', 'vendre', 'vente']

const DATE_PATTERNS = [

  { regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO' },

  { regex: /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i, format: 'US' },

  { regex: /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/, format: 'EU' },

  { regex: /^\d{4}-\d{2}-\d{2}$/, format: 'ISO_DATE' },

  { regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, format: 'SLASH_DATE' },

  { regex: /^\d{10,13}$/, format: 'UNIX' },
]

export const SUPPORTED_PLATFORMS = [
  'Tradezella',
  'Tradovate', 
  'NinjaTrader',
  'FTMO',
  'Topstep',
  'Exness',
  'Match Trader',
  'MetaTrader 4/5',
  'cTrader',
  'TradingView',
  'Rithmic',
  'Sierra Chart',
  'Quantower',
  'TradeStation',
  'ThinkOrSwim',
  'Interactive Brokers',
  'Generic CSV'
] as const


function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\u2019''′`]/g, "'")
    .replace(/[^a-z0-9']/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}


function findFieldMatch(header: string): keyof MappedFields | null {
  const normalizedHeader = normalizeHeader(header)


  for (const [field, patterns] of Object.entries(FIELD_MAPPINGS)) {
    for (const pattern of patterns) {
      if (normalizedHeader === normalizeHeader(pattern)) {
        return field as keyof MappedFields
      }
    }
  }
  
  for (const [field, patterns] of Object.entries(FIELD_MAPPINGS)) {
    for (const pattern of patterns) {
      const normalizedPattern = normalizeHeader(pattern)


      if (
        normalizedPattern.length >= 8 &&
        (normalizedHeader.includes(normalizedPattern) || normalizedPattern.includes(normalizedHeader))
      ) {
        return field as keyof MappedFields
      }
    }
  }
  
  return null
}


function parseDate(value: string, fallbackTimezone: string = 'America/New_York'): string | null {
  if (!value || value.trim() === '') return null
  
  const trimmed = value.trim()
  

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {


    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
    const date = new Date(hasTimezone ? trimmed : `${trimmed}Z`)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  

  if (/^\d{10,13}$/.test(trimmed)) {
    const timestamp = parseInt(trimmed)
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i)
  if (usMatch) {
    let [, month, day, year, hours, minutes, seconds, ampm] = usMatch
    let hour24 = parseInt(hours || '0')
    
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12
      else if (ampm.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0
    }
    
    const date = new Date(
      parseInt(year || '0'),
      parseInt(month || '1') - 1,
      parseInt(day || '1'),
      hour24,
      parseInt(minutes || '0'),
      parseInt(seconds || '0')
    )
    
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  

  const euMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (euMatch) {
    const [, day, month, year, hours, minutes, seconds] = euMatch
    const date = new Date(
      parseInt(year || '0'),
      parseInt(month || '1') - 1,
      parseInt(day || '1'),
      parseInt(hours || '0'),
      parseInt(minutes || '0'),
      parseInt(seconds || '0')
    )
    
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  

  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    return date.toISOString()
  }
  
  return null
}


function parseNumeric(value: string): number | null {
  if (!value || value.trim() === '') return null
  
  let cleaned = value.trim()
  

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }
  

  cleaned = cleaned.replace(/[$€£¥₹,\s]/g, '')
  

  if (/^\-?\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.')
  }
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}


function parseDuration(value: string): number | null {
  if (!value || value.trim() === '') return null
  
  const trimmed = value.trim()
  

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed))
  }
  

  const minSecMatch = trimmed.match(/(\d+)\s*(min|m)\s*(\d+)?\s*(sec|s)?/i)
  if (minSecMatch) {
    const minutes = parseInt(minSecMatch[1] || '0') || 0
    const seconds = parseInt(minSecMatch[3] || '0') || 0
    return minutes * 60 + seconds
  }
  

  const timeMatch = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (timeMatch) {
    if (timeMatch[3]) {

      return parseInt(timeMatch[1] || '0') * 3600 + parseInt(timeMatch[2] || '0') * 60 + parseInt(timeMatch[3] || '0')
    } else {

      return parseInt(timeMatch[1] || '0') * 60 + parseInt(timeMatch[2] || '0')
    }
  }
  
  return null
}


function parseSide(value: string): 'BUY' | 'SELL' | null {
  if (!value || value.trim() === '') return null
  
  const normalized = value.toLowerCase().trim()
  
  if (LONG_VALUES.includes(normalized)) return 'BUY'
  if (SHORT_VALUES.includes(normalized)) return 'SELL'
  

  if (LONG_VALUES.some(v => normalized.includes(v))) return 'BUY'
  if (SHORT_VALUES.some(v => normalized.includes(v))) return 'SELL'
  
  return null
}


function detectPlatform(headers: string[]): string | null {
  const normalizedHeaders = headers.map(h => normalizeHeader(h))
  const headerSet = new Set(normalizedHeaders)
  

  if (headerSet.has('opening_time_utc') && headerSet.has('closing_time_utc') && headerSet.has('lots')) {
    return 'Exness'
  }
  

  if (headerSet.has('open_time') && headerSet.has('close_time') && headerSet.has('reason')) {
    return 'Match Trader'
  }
  

  if (headerSet.has('boughttimestamp') && headerSet.has('soldtimestamp') && headerSet.has('buyfillid')) {
    return 'Tradovate'
  }
  

  if ((headerSet.has('entry_time') && headerSet.has('exit_time') && headerSet.has('market_pos')) ||
      (headerSet.has('heure_d_entree') && headerSet.has('heure_de_sortie'))) {
    return 'NinjaTrader'
  }
  

  if (headerSet.has('contractname') && headerSet.has('enteredat') && headerSet.has('exitedat')) {
    return 'Topstep'
  }
  

  if (headers.length >= 14 && normalizedHeaders.includes('ticket') && normalizedHeaders.includes('ouvrir')) {
    return 'FTMO'
  }
  

  if (headerSet.has('account_name') && headerSet.has('open_date') && headerSet.has('gross_p_l')) {
    return 'Tradezella'
  }
  
  return 'Generic CSV'
}


export function processUniversalCSV(
  headers: string[],
  data: string[][],
  options: {
    fallbackTimezone?: string
    skipEmptyRows?: boolean
    requirePnl?: boolean
  } = {}
): ProcessingResult {
  const {
    fallbackTimezone = 'America/New_York',
    skipEmptyRows = true,
    requirePnl = false
  } = options
  
  const result: ProcessingResult = {
    success: false,
    trades: [],
    warnings: [],
    errors: [],
    detectedPlatform: detectPlatform(headers),
    mappedFields: {
      instrument: null,
      side: null,
      quantity: null,
      entryPrice: null,
      closePrice: null,
      entryDate: null,
      closeDate: null,
      pnl: null,
      commission: null,
      stopLoss: null,
      takeProfit: null,
      swap: null,
      timeInPosition: null,
      ticket: null
    },
    missingRequiredFields: [],
    stats: {
      totalRows: data.length,
      processedRows: 0,
      skippedRows: 0,
      tradesWithStopLoss: 0,
      tradesWithTakeProfit: 0,
      tradesWithCommission: 0
    }
  }
  
  const headerMapping: Record<number, keyof MappedFields> = {}
  
  headers.forEach((header, index) => {
    const field = findFieldMatch(header)
    if (field && !result.mappedFields[field]) {
      headerMapping[index] = field
      result.mappedFields[field] = header
    }
  })
  

  const requiredFields: (keyof MappedFields)[] = ['instrument', 'entryDate']
  const optionalButImportant: (keyof MappedFields)[] = ['pnl', 'entryPrice', 'closePrice', 'side', 'quantity']
  
  for (const field of requiredFields) {
    if (!result.mappedFields[field]) {
      result.missingRequiredFields.push(field)
    }
  }
  
  if (requirePnl && !result.mappedFields.pnl) {
    result.missingRequiredFields.push('pnl')
  }
  
  if (result.missingRequiredFields.includes('instrument') || result.missingRequiredFields.includes('entryDate')) {
    result.errors.push({
      row: 0,
      message: `Missing required fields: ${result.missingRequiredFields.join(', ')}. Cannot process CSV.`,
      fatal: true
    })
    return result
  }
  
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    
    if (!row) continue
    
    if (skipEmptyRows && row.every(cell => !cell || cell.trim() === '')) {
      result.stats.skippedRows++
      continue
    }
    

    const firstCell = row[0]?.toLowerCase() || ''
    if (firstCell.includes('total') || firstCell.includes('summary') || firstCell === '') {
      result.stats.skippedRows++
      continue
    }
    
    const trade: Partial<TradeType> = {}
    let hasError = false
    
    for (const [indexStr, field] of Object.entries(headerMapping)) {
      const index = parseInt(indexStr)
      const cellValue = row[index]
      
      if (!cellValue || cellValue.trim() === '') continue
      
      switch (field) {
        case 'instrument':

          let instrument = cellValue.trim()

          instrument = instrument.replace(/\s+\d{2}-\d{2}$/, '')

          instrument = instrument.replace(/m$/, '')
          trade.instrument = instrument
          break
          
        case 'side':
          const side = parseSide(cellValue)
          if (side) trade.side = side
          break
          
        case 'quantity':
          const qty = parseNumeric(cellValue)
          if (qty !== null) trade.quantity = Math.abs(qty)
          break
          
        case 'entryPrice':
          const entryPrice = parseNumeric(cellValue)
          if (entryPrice !== null) trade.entryPrice = entryPrice.toString()
          break
          
        case 'closePrice':
          const closePrice = parseNumeric(cellValue)
          if (closePrice !== null) trade.closePrice = closePrice.toString()
          break
          
        case 'entryDate':
          const entryDate = parseDate(cellValue, fallbackTimezone)
          if (entryDate) trade.entryDate = entryDate
          break
          
        case 'closeDate':
          const closeDate = parseDate(cellValue, fallbackTimezone)
          if (closeDate) trade.closeDate = closeDate
          break
          
        case 'pnl':
          const pnl = parseNumeric(cellValue)
          if (pnl !== null) trade.pnl = pnl
          break
          
        case 'commission':
          const commission = parseNumeric(cellValue)
          if (commission !== null) {

            trade.commission = commission > 0 ? -commission : commission
            result.stats.tradesWithCommission++
          }
          break
          
        case 'stopLoss':
          const sl = parseNumeric(cellValue)
          if (sl !== null && sl !== 0) {
            trade.stopLoss = sl.toString() as any
            result.stats.tradesWithStopLoss++
          }
          break
          
        case 'takeProfit':
          const tp = parseNumeric(cellValue)
          if (tp !== null && tp !== 0) {
            trade.takeProfit = tp.toString() as any
            result.stats.tradesWithTakeProfit++
          }
          break
          
        case 'swap':
          const swap = parseNumeric(cellValue)
          if (swap !== null) {

            trade.commission = (trade.commission || 0) + (swap < 0 ? swap : -swap)
          }
          break
          
        case 'timeInPosition':
          const duration = parseDuration(cellValue)
          if (duration !== null) trade.timeInPosition = duration
          break
          
        case 'ticket':
          trade.entryId = cellValue.trim()
          break
      }
    }
    
    if (!trade.instrument) {
      result.warnings.push({ row: rowIndex + 2, field: 'instrument', message: 'Missing instrument' })
      result.stats.skippedRows++
      continue
    }
    
    if (!trade.entryDate) {
      result.warnings.push({ row: rowIndex + 2, field: 'entryDate', message: 'Missing or invalid entry date' })
      result.stats.skippedRows++
      continue
    }
    

    if (!trade.timeInPosition && trade.entryDate && trade.closeDate) {
      trade.timeInPosition = calculateTradeDuration(trade.entryDate, trade.closeDate, fallbackTimezone)
    }
    

    if (!trade.quantity) {
      trade.quantity = 1
    }
    

    if (!trade.side && trade.entryPrice && trade.closePrice && trade.pnl !== undefined) {
      const entryNum = parseFloat(trade.entryPrice)
      const closeNum = parseFloat(trade.closePrice)
      if (trade.pnl > 0) {
        trade.side = closeNum > entryNum ? 'BUY' : 'SELL'
      } else if (trade.pnl < 0) {
        trade.side = closeNum < entryNum ? 'BUY' : 'SELL'
      }
    }
    
    trade.id = generateTradeHash(trade as TradeType).toString()
    
    result.trades.push(trade)
    result.stats.processedRows++
  }
  
  result.success = result.trades.length > 0
  

  if (result.stats.tradesWithStopLoss < result.trades.length * 0.5) {
    result.warnings.push({
      row: 0,
      field: 'stopLoss',
      message: `Only ${result.stats.tradesWithStopLoss} of ${result.trades.length} trades have stop loss data. R-Multiple calculations will be limited.`
    })
  }
  
  return result
}


function validateCSV(headers: string[]): { 
  valid: boolean
  mappedFields: MappedFields
  missingRequired: string[]
  suggestions: string[]
} {
  const mappedFields: MappedFields = {
    instrument: null,
    side: null,
    quantity: null,
    entryPrice: null,
    closePrice: null,
    entryDate: null,
    closeDate: null,
    pnl: null,
    commission: null,
    stopLoss: null,
    takeProfit: null,
    swap: null,
    timeInPosition: null,
    ticket: null
  }
  
  headers.forEach(header => {
    const field = findFieldMatch(header)
    if (field && !mappedFields[field]) {
      mappedFields[field] = header
    }
  })
  
  const missingRequired: string[] = []
  const suggestions: string[] = []
  
  if (!mappedFields.instrument) {
    missingRequired.push('instrument/symbol')
    suggestions.push('Add a column named "Symbol" or "Instrument" with the traded asset name')
  }
  
  if (!mappedFields.entryDate) {
    missingRequired.push('entry date/time')
    suggestions.push('Add a column with entry timestamp (e.g., "Entry Date", "Open Time")')
  }
  
  if (!mappedFields.pnl && !mappedFields.entryPrice) {
    suggestions.push('Consider adding P&L or entry/exit prices for better analysis')
  }
  
  return {
    valid: missingRequired.length === 0,
    mappedFields,
    missingRequired,
    suggestions
  }
}

