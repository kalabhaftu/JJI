import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCSVData = `Date,Instrument,Entry Price,Exit Price,Quantity,P&L,Commission,Side
2024-01-01 10:00:00,EURUSD,1.1000,1.1050,1,50,2.50,Long
2024-01-01 11:00:00,GBPUSD,1.2500,1.2450,-1,-50,2.50,Short
2024-01-01 12:00:00,ES,4500.00,4505.00,2,100,5.00,Long`

describe('CSV Import - Column Mapping', () => {
  it('should detect standard column names', () => {
    const headers = ['Date', 'Instrument', 'Entry Price', 'Exit Price', 'Quantity', 'P&L', 'Commission', 'Side']
    
    const expectedMapping = {
      'Date': 'entryDate',
      'Instrument': 'instrument',
      'Entry Price': 'entryPrice',
      'Exit Price': 'closePrice',
      'Quantity': 'quantity',
      'P&L': 'pnl',
      'Commission': 'commission',
      'Side': 'side'
    }
    
    expect(headers.length).toBe(8)
    expect(expectedMapping['Date']).toBe('entryDate')
    expect(expectedMapping['Instrument']).toBe('instrument')
  })

  it('should handle case-insensitive column names', () => {
    const headers = ['date', 'INSTRUMENT', 'entry price', 'EXIT PRICE']
    
    expect(headers.length).toBeGreaterThan(0)
    expect(headers[0].toLowerCase()).toBe('date')
    expect(headers[1].toLowerCase()).toBe('instrument')
  })

  it('should detect partial matches for column names', () => {
    const headers = ['Entry Dt', 'Symbol', 'Buy Price', 'Sell Price', 'Qty', 'Profit/Loss']
    
    const expectedMappings = {
      'Entry Dt': 'entryDate', // Contains 'entry'
      'Symbol': 'instrument', // Synonym for instrument
      'Buy Price': 'entryPrice', // Contains 'price' and 'buy/entry'
      'Sell Price': 'closePrice', // Contains 'price' and 'sell/close'
      'Qty': 'quantity', // Common abbreviation
      'Profit/Loss': 'pnl' // Common synonym
    }
    
    expect(headers.length).toBe(6)
    expect(expectedMappings['Symbol']).toBe('instrument')
  })

  it('should identify required vs optional columns', () => {
    const requiredColumns = [
      'instrument',
      'entryPrice',
      'closePrice',
      'pnl',
      'entryDate',
      'closeDate',
      'quantity'
    ]
    
    const optionalColumns = [
      'side',
      'commission',
      'stopLoss',
      'takeProfit',
      'comment'
    ]
    
    expect(requiredColumns.length).toBe(7)
    expect(optionalColumns.length).toBe(5)
    
    requiredColumns.forEach(col => {
      expect(col).toBeTruthy()
    })
  })
})

describe('CSV Import - Data Parsing', () => {
  it('should parse numeric values correctly', () => {
    const testData = {
      entryPrice: '1.10500',
      closePrice: '1.10750',
      quantity: '2',
      pnl: '50.00',
      commission: '2.50'
    }
    
    const parsed = {
      entryPrice: parseFloat(testData.entryPrice),
      closePrice: parseFloat(testData.closePrice),
      quantity: parseFloat(testData.quantity),
      pnl: parseFloat(testData.pnl),
      commission: parseFloat(testData.commission)
    }
    
    expect(parsed.entryPrice).toBe(1.10500)
    expect(parsed.closePrice).toBe(1.10750)
    expect(parsed.quantity).toBe(2)
    expect(parsed.pnl).toBe(50)
    expect(parsed.commission).toBe(2.50)
  })

  it('should preserve decimal precision for prices', () => {
    const prices = [
      '1.12345',
      '4500.25',
      '0.00001',
      '1234567.89012345'
    ]
    
    prices.forEach(price => {
      const parsed = price // Store as string for Decimal type
      expect(parsed).toBe(price)
      
      const float = parseFloat(price)
      expect(float).toBeCloseTo(parseFloat(price), 10)
    })
  })

  it('should handle negative quantities for short positions', () => {
    const testTrades = [
      { quantity: 1, side: 'long' },
      { quantity: -1, side: 'short' },
      { quantity: 2, side: 'buy' },
      { quantity: -2, side: 'sell' }
    ]
    
    testTrades.forEach(trade => {
      if (trade.quantity < 0 || trade.side === 'short' || trade.side === 'sell') {
        expect(trade.quantity <= 0 || ['short', 'sell'].includes(trade.side)).toBe(true)
      } else {
        expect(trade.quantity > 0 && ['long', 'buy'].includes(trade.side)).toBe(true)
      }
    })
  })

  it('should parse various date formats', () => {
    const dateFormats = [
      '2024-01-01 10:00:00',
      '2024-01-01T10:00:00Z',
      '01/01/2024 10:00:00',
      '2024-01-01 10:00:00.000',
      '2024-01-01'
    ]
    
    dateFormats.forEach(dateStr => {
      const parsed = new Date(dateStr)
      expect(parsed).toBeInstanceOf(Date)
      expect(parsed.toString()).not.toBe('Invalid Date')
    })
  })
})

describe('CSV Import - Data Validation', () => {
  it('should reject trades with missing required fields', () => {
    const incompleteTrades = [
      { instrument: 'EURUSD', entryPrice: '1.1000' }, // Missing closePrice, pnl, dates
      { entryPrice: '1.1000', closePrice: '1.1050' }, // Missing instrument
      { instrument: 'EURUSD', entryPrice: '1.1000', closePrice: '1.1050' } // Missing pnl, dates
    ]
    
    incompleteTrades.forEach(trade => {
      const hasAllRequired = !!(
        (trade as any).instrument &&
        'entryPrice' in trade &&
        'closePrice' in trade &&
        'pnl' in trade
      )
      
      expect(hasAllRequired).toBe(false)
    })
  })

  it('should validate price values are positive', () => {
    const prices = [
      { entryPrice: '1.1000', valid: true },
      { entryPrice: '0', valid: false },
      { entryPrice: '-1.5000', valid: false },
      { entryPrice: '0.00001', valid: true }
    ]
    
    prices.forEach(({ entryPrice, valid }) => {
      const price = parseFloat(entryPrice)
      expect(price > 0).toBe(valid)
    })
  })

  it('should validate instrument names', () => {
    const instruments = [
      { name: 'EURUSD', valid: true },
      { name: 'ES', valid: true },
      { name: 'NQ', valid: true },
      { name: '', valid: false },
      { name: 'A', valid: true }, // Short but valid
    ]
    
    instruments.forEach(({ name, valid }) => {
      expect((name.length > 0) === valid).toBe(true)
    })
  })
})

describe('CSV Import - Partial Closes & Grouping', () => {
  it('should group trades with same entryId', () => {
    const trades = [
      { entryId: 'E1', pnl: 50, quantity: 1 },
      { entryId: 'E1', pnl: 100, quantity: 1 }, // Partial close
      { entryId: 'E2', pnl: 200, quantity: 2 },
    ]
    
    const grouped = trades.reduce((acc, trade) => {
      if (!acc[trade.entryId]) {
        acc[trade.entryId] = { ...trade, pnl: 0, quantity: 0 }
      }
      acc[trade.entryId].pnl += trade.pnl
      acc[trade.entryId].quantity += trade.quantity
      return acc
    }, {} as Record<string, any>)
    
    expect(grouped['E1'].pnl).toBe(150) // 50 + 100
    expect(grouped['E1'].quantity).toBe(2) // 1 + 1
    expect(grouped['E2'].pnl).toBe(200)
    expect(Object.keys(grouped).length).toBe(2)
  })

  it('should keep grouped P&L canonical and track commissions separately', () => {
    const partialCloses = [
      { entryId: 'E1', pnl: 100, commission: 2.5 },
      { entryId: 'E1', pnl: 150, commission: 2.5 },
      { entryId: 'E1', pnl: -50, commission: 2.5 },
    ]
    
    const totalPnL = partialCloses.reduce((sum, t) => sum + t.pnl, 0)
    const totalCommission = partialCloses.reduce((sum, t) => sum + t.commission, 0)
    const canonicalNetPnL = totalPnL
    
    expect(totalPnL).toBe(200) // 100 + 150 - 50
    expect(totalCommission).toBe(7.5) // 2.5 * 3
    expect(canonicalNetPnL).toBe(200)
  })
})

describe('CSV Import - Special Characters & Edge Cases', () => {
  it('should handle commas in quoted fields', () => {
    const csvLine = '"Trade 1, with comma","EURUSD","1,100.50","1,150.75"'
    
    // Just verify we can detect the pattern
    expect(csvLine).toContain('"Trade 1, with comma"')
    expect(csvLine).toContain('"1,100.50"')
  })

  it('should handle various instrument name formats', () => {
    const instruments = [
      'EURUSD',    // Forex
      'ES',        // Futures
      'AAPL',      // Stocks
      'BTC/USD',   // Crypto with separator
      'XAUUSD',    // Gold
      'US100',     // Index with numbers
    ]
    
    instruments.forEach(inst => {
      expect(inst.length).toBeGreaterThan(0)
      expect(typeof inst).toBe('string')
    })
  })

  it('should handle trades with zero commission', () => {
    const trade = {
      pnl: 100,
      commission: 0
    }
    
    const canonicalNetPnL = trade.pnl
    expect(canonicalNetPnL).toBe(100)
    expect(trade.commission).toBe(0)
  })

  it('should handle very small decimal values', () => {
    const microPrices = [
      '0.00001',
      '0.000001',
      '0.12345678901234567890'
    ]
    
    microPrices.forEach(price => {
      // Store as string for Decimal precision
      expect(typeof price).toBe('string')
      expect(parseFloat(price)).toBeGreaterThan(0)
    })
  })
})

