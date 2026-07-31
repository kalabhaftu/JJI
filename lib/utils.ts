import type { TradeType as Trade } from '@/lib/db/schema/trades';

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { formatInTimeZone } from 'date-fns-tz'
import { formatTradePrice, getDecimalPlaces } from './trading/precision'
import { StatisticsProps } from "@/app/dashboard/types/statistics"
import { Account } from "@/context/data-provider"
import { ExtendedTrade, MarketBias } from "@/types/trade-extended"
import {
  calculateWinRate as calculateOutcomeWinRate,
  classifyOutcome,
  DEFAULT_BREAK_EVEN_THRESHOLD,
} from '@/lib/metrics/outcome'
import { getTradeGrossPnl, getTradeNetPnl } from '@/lib/metrics/pnl'
import { calculateTradeRMultiple } from '@/lib/math/performance-metrics'
import {
  buildTradeIdentityKey,
  getTradeClosePriceValue,
  getTradeEntryPriceValue,
  getTradeEntryTimestamp,
  getTradeExitTimestamp,
  parseTradeChartLinks,
} from '@/lib/trade-core'

export const DEFAULT_TIMEZONE = "America/New_York";

export function ensureExtendedTrade(trade: Trade): ExtendedTrade {
  return {
    ...trade,
    tags: Array.isArray(trade.tags) ? (trade.tags as string[]) : [],
    selectedRules: Array.isArray(trade.selectedRules) ? (trade.selectedRules as string[]) : [],
    marketBias: (trade.marketBias as MarketBias) || null,
    selectedNews: (trade.selectedNews as string) || null,
    chartLinks: parseTradeChartLinks(trade as any),
  } as ExtendedTrade
}

// Win rate = (Wins / (Wins + Losses)) * 100. Break-even trades are excluded
// from both numerator and denominator.
export function calculateWinRate(winCount: number, lossCount: number): number {
  return calculateOutcomeWinRate(winCount, lossCount)
}

export function classifyTrade(
  netPnL: number,
  threshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
): 'win' | 'loss' | 'breakeven' {
  return classifyOutcome(netPnL, threshold)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPnlIntensity(pnl: number): number {
  const absPnl = Math.abs(pnl)
  if (absPnl === 0) return 0
  if (absPnl < 100) return 0.08
  if (absPnl < 500) return 0.12
  if (absPnl < 1000) return 0.18
  if (absPnl < 5000) return 0.25
  return 0.35
}

export function formatTradeDate(
  date: string | Date | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  includeDayOfWeek: boolean = true
): string {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  const pattern = includeDayOfWeek ? 'EEE, MMM d, yyyy' : 'MMM d, yyyy'
  return formatInTimeZone(d, timezone, pattern)
}

export function formatNumber(value: number, maxDecimals: number = 4): string {
  if (isNaN(value) || !isFinite(value)) return '0'

  const formatted = value.toFixed(maxDecimals)
  return parseFloat(formatted).toString()
}

export function formatCurrency(value: number, maxDecimals: number = 2): string {
  if (isNaN(value) || !isFinite(value)) return '$0'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(value)
}

function formatPercentage(value: number, maxDecimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) return '0%'

  const formatted = (value * 100).toFixed(maxDecimals)
  const cleanNumber = parseFloat(formatted)
  return `${cleanNumber}%`
}

export function formatPercent(value: number, maxDecimals: number = 2): string {
  if (isNaN(value) || !isFinite(value)) return '0%'

  const formatted = value.toFixed(maxDecimals)
  const cleanNumber = parseFloat(formatted)
  return `${cleanNumber}%`
}

export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue) || !isFinite(numValue)) return '0'

  const formatted = numValue.toFixed(4)
  const cleanNumber = parseFloat(formatted)
  return cleanNumber.toString()
}

function formatPrice(price: string | number | { toString(): string }, instrument: string, forAggregation: boolean = false): string {
  if (price === null || price === undefined || price === '') return '0'

  let numPrice: number
  if (typeof price === 'object' && 'toString' in price) {
    numPrice = parseFloat(price.toString())
  } else if (typeof price === 'string') {
    numPrice = parseFloat(price)
  } else {
    numPrice = price as number
  }

  if (isNaN(numPrice) || !isFinite(numPrice)) return '0'

  if (forAggregation) {
    const precision = getDecimalPlaces(instrument, numPrice)
    return numPrice.toFixed(precision)
  }

  return formatTradePrice(numPrice, instrument)
}

export function formatTradeData(trade: Trade, timezone?: string) {
  const instrument = trade.instrument || ''
  const grossPnl = getTradeGrossPnl(trade)
  const netPnl = getTradeNetPnl(trade)

  return {
    instrument: instrument || 'N/A',
    accountNumber: trade.accountNumber || 'N/A',
    side: trade.side?.toUpperCase() || 'N/A',

    quantity: formatQuantity(trade.quantity),
    quantityWithUnit: `${formatQuantity(trade.quantity)} lots`,
    entryPrice: formatPrice(getTradeEntryPriceValue(trade as any) ?? trade.entryPrice, instrument),
    closePrice: trade.closePrice ? formatPrice(getTradeClosePriceValue(trade as any) ?? trade.closePrice, instrument) : 'Open',
    entryPriceCurrency: `$${formatPrice(getTradeEntryPriceValue(trade as any) ?? trade.entryPrice, instrument)}`,
    closePriceCurrency: trade.closePrice ? `$${formatPrice(getTradeClosePriceValue(trade as any) ?? trade.closePrice, instrument)}` : 'Open',

    pnl: grossPnl,
    pnlFormatted: formatCurrency(grossPnl),
    commission: trade.commission || 0,
    commissionFormatted: formatCurrency(trade.commission || 0),
    grossPnl,
    grossPnlFormatted: formatCurrency(grossPnl),
    netPnl,
    netPnlFormatted: formatCurrency(netPnl),

    entryDate: getTradeEntryTimestamp(trade as any),
    closeDate: getTradeExitTimestamp(trade as any),
    entryDateFormatted: getTradeEntryTimestamp(trade as any) ? formatInTimeZone(getTradeEntryTimestamp(trade as any)!, timezone || 'America/New_York', 'MMM d, yyyy HH:mm:ss') : 'N/A',
    closeDateFormatted: getTradeExitTimestamp(trade as any) ? formatInTimeZone(getTradeExitTimestamp(trade as any)!, timezone || 'America/New_York', 'MMM d, yyyy HH:mm:ss') : 'Open',
    entryDateShort: getTradeEntryTimestamp(trade as any) ? formatInTimeZone(getTradeEntryTimestamp(trade as any)!, timezone || 'America/New_York', 'MMM d, yyyy') : 'N/A',
    closeDateShort: getTradeExitTimestamp(trade as any) ? formatInTimeZone(getTradeExitTimestamp(trade as any)!, timezone || 'America/New_York', 'MMM d, yyyy') : 'Open',

    timeInPosition: trade.timeInPosition || 0,
    timeInPositionFormatted: parsePositionTime(trade.timeInPosition || 0),

    isWin: classifyTrade(netPnl) === 'win',
    isLoss: classifyTrade(netPnl) === 'loss',
    isBreakEven: classifyTrade(netPnl) === 'breakeven',
    isOpen: !trade.closeDate,
    isClosed: !!trade.closeDate,

    stopLoss: (trade as any).stopLoss || null,
    takeProfit: (trade as any).takeProfit || null,
    closeReason: (trade as any).closeReason || null,
    comment: trade.comment || null,

    id: trade.id,
    entryId: trade.entryId || null,
    groupId: trade.groupId || null,

    tradingModel: (trade as any).tradingModel || null,

    raw: trade
  }
}

export function cleanContent(content: any): any {
  if (content === null || content === undefined) return content;

  if (typeof content === 'string') {
    return content.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2300}-\u{23FF}]/gu, (match) => {
      const preservedSymbols = [
        0x2318,
        0x2192,
        0x2190,
        0x2191,
        0x2193,
        0x2713,
        0x2714,
        0x2716,
        0x2717,
        0x00a9,
        0x00ae,
        0x2122,
      ].map((code) => String.fromCodePoint(code))
      if (preservedSymbols.includes(match)) return match;
      return '';
    }).trim()
  } else if (Array.isArray(content)) {
    return content.map(item => cleanContent(item))
  } else if (typeof content === 'object') {
    const cleaned: any = {}
    for (const key in content) {
      cleaned[key] = cleanContent(content[key])
    }
    return cleaned
  }
  return content
}

export function formatNoteContent(content: string | null | undefined): string {
  if (!content) return "";
  
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return content;

  try {
    const parsed = JSON.parse(trimmed);
    
    if (!parsed.root || !parsed.root.children) return content;

    const extractText = (nodes: any[]): string => {
      return nodes.map(node => {
        if (node.text) return node.text;
        if (node.children) {
          const childrenText = extractText(node.children);
          if (['paragraph', 'listitem', 'heading', 'quote'].includes(node.type)) {
            return childrenText + '\n';
          }
          return childrenText;
        }
        if (node.type === 'linebreak') return '\n';
        return "";
      }).join("");
    };

    return extractText(parsed.root.children).trim();
  } catch (e) {
    return content;
  }
}

export function parsePositionTime(timeInSeconds: number): string {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutesLeft = Math.floor((timeInSeconds - (hours * 3600)) / 60);
  const secondsLeft = Math.floor(timeInSeconds - (hours * 3600) - (minutesLeft * 60));

  if (isNaN(hours) || isNaN(minutesLeft) || isNaN(secondsLeft)) {
    return '0';
  }

  const formattedTime = [
    hours > 0 ? `${hours}h` : '',
    `${minutesLeft}m`,
    `${secondsLeft}s`
  ].filter(Boolean).join(' ');

  return formattedTime;
}

export interface GroupedTrade extends Trade {
  partialTrades: Trade[]  // Array of all partial closes
  isGrouped: boolean      // Flag to indicate this is a grouped trade
  pnl: number
  commission: number
  quantity: number
  timeInPosition: number
  exitTime: Date | null
  entryTime: Date | null
  closeDate: string
  entryDate: string
  closePrice: string
  entryPrice: string
  accountNumber: string
  symbol: string | null
  instrument: string
  side: string | null
}

export function groupTradesByExecution(trades: Trade[]): GroupedTrade[] {
  const groups = new Map<string, GroupedTrade>()

  trades.forEach(trade => {
  let key: string
    if (trade.entryId && trade.entryId.trim() !== '') {
      key = `entryId:${trade.entryId}`
    } else {
      const entryDate = getTradeEntryTimestamp(trade as any) ?? new Date(trade.entryDate)
      const roundedTime = new Date(entryDate)
      roundedTime.setSeconds(0, 0)
      key = `fallback:${trade.instrument}:${roundedTime.toISOString()}:${trade.side}`
    }

    if (!groups.has(key)) {
      groups.set(key, {
        ...trade,
        partialTrades: [trade],
        isGrouped: false,
        pnl: trade.pnl || 0,
        commission: trade.commission || 0,
        quantity: trade.quantity || 0,
        timeInPosition: trade.timeInPosition || 0,
        exitTime: trade.exitTime || null,
        entryTime: trade.entryTime || null,
        closeDate: (trade as any).closeDate || "",
        entryDate: (trade as any).entryDate || "",
        closePrice: (trade as any).closePrice || "0",
        entryPrice: (trade as any).entryPrice || "0",
        accountNumber: (trade as any).accountNumber || "",
        symbol: (trade as any).symbol || null,
        instrument: (trade as any).instrument || "",
        side: (trade as any).side || null
      } as GroupedTrade)
    } else {
      const group = groups.get(key)!

      group.partialTrades.push(trade)
      group.isGrouped = true

      group.pnl += trade.pnl || 0
      group.commission += trade.commission || 0

      group.quantity += trade.quantity || 0

      if ((trade.timeInPosition || 0) > (group.timeInPosition || 0)) {
        group.timeInPosition = trade.timeInPosition || 0
        group.closeDate = trade.closeDate // Update close date to match longest time
        group.closePrice = trade.closePrice // Update close price to last execution
        if (trade.exitTime) group.exitTime = trade.exitTime
      }
    }
  })

  return Array.from(groups.values())
}

export function calculateStatistics(
  trades: Trade[],
  accounts: Account[] = [],
  preGrouped?: GroupedTrade[],
  breakEvenThreshold: number = DEFAULT_BREAK_EVEN_THRESHOLD
): StatisticsProps {
  if (!trades.length) {
    return {
      breakEvenThreshold,
      cumulativeFees: 0,
      cumulativePnl: 0,
      winningStreak: 0,
      winRate: 0,
      nbTrades: 0,
      nbBe: 0,
      nbWin: 0,
      nbLoss: 0,
      totalPositionTime: 0,
      averagePositionTime: '0s',
      profitFactor: 0,
      grossLosses: 0,
      grossWin: 0,
      biggestWin: 0,
      biggestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      totalPayouts: 0,
      nbPayouts: 0,
      totalPnL: 0,
    }
  }

  const groupedTrades = preGrouped ?? groupTradesByExecution(trades)

  const accountMap = new Map(accounts.map(account => [account.number, account]));

  const filteredTrades = groupedTrades;

  if (!filteredTrades.length) {
    return {
      breakEvenThreshold,
      cumulativeFees: 0,
      cumulativePnl: 0,
      winningStreak: 0,
      winRate: 0,
      nbTrades: 0,
      nbBe: 0,
      nbWin: 0,
      nbLoss: 0,
      totalPositionTime: 0,
      averagePositionTime: '0s',
      profitFactor: 0,
      grossLosses: 0,
      grossWin: 0,
      biggestWin: 0,
      biggestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      totalPayouts: 0,
      nbPayouts: 0,
      totalPnL: 0,
    }
  }

  const initialStatistics: StatisticsProps = {
    breakEvenThreshold,
    cumulativeFees: 0,
    cumulativePnl: 0,
    winningStreak: 0,
    winRate: 0,
    nbTrades: 0,
    nbBe: 0,
    nbWin: 0,
    nbLoss: 0,
    totalPositionTime: 0,
    averagePositionTime: '0s',
    profitFactor: 1,
    grossLosses: 0,
    grossWin: 0,
    biggestWin: 0,
    biggestLoss: 0,
    averageWin: 0,
    averageLoss: 0,
    totalPayouts: 0,
    nbPayouts: 0,
    totalPnL: 0,
  };

  let currentWinningStreak = 0;
  let maxWinningStreak = 0;

  if (initialStatistics.totalPnL === undefined) {
    (initialStatistics as any).totalPnL = 0;
  }
  if (initialStatistics.averageWin === undefined) {
    (initialStatistics as any).averageWin = 0;
  }
  if (initialStatistics.averageLoss === undefined) {
    (initialStatistics as any).averageLoss = 0;
  }

  const statistics = filteredTrades.reduce((acc: StatisticsProps, trade: Trade) => {
    const pnl = Number(trade.pnl) || 0;
    const commission = Math.abs(Number(trade.commission) || 0);
    const timeInPosition = Number(trade.timeInPosition) || 0;

    const netPnl = pnl;

    acc.nbTrades++;
    acc.cumulativePnl += pnl;
    acc.cumulativeFees += commission;
    acc.totalPositionTime += timeInPosition;

    if ((acc as any).totalPnL === undefined) (acc as any).totalPnL = 0;
    (acc as any).totalPnL += netPnl;

    if (netPnl > acc.biggestWin) {
      acc.biggestWin = netPnl;
    }
    if (netPnl < acc.biggestLoss) {
      acc.biggestLoss = netPnl;
    }

    const outcome = classifyTrade(netPnl, breakEvenThreshold)
    if (outcome === 'breakeven') {
      acc.nbBe++;
      currentWinningStreak = 0; // Break-even breaks winning streak
    } else if (outcome === 'win') {
      acc.nbWin++;
      acc.grossWin += netPnl;
      currentWinningStreak++;
      if (currentWinningStreak > maxWinningStreak) {
        maxWinningStreak = currentWinningStreak;
      }
    } else {
      acc.nbLoss++;
      acc.grossLosses += Math.abs(netPnl);
      currentWinningStreak = 0; // Loss breaks winning streak
    }

    return acc;
  }, { ...initialStatistics });

  statistics.winRate = calculateOutcomeWinRate(statistics.nbWin, statistics.nbLoss)

  if (statistics.nbWin > 0) {
    (statistics as any).averageWin = statistics.grossWin / statistics.nbWin;
  } else {
    (statistics as any).averageWin = 0;
  }

  if (statistics.nbLoss > 0) {
    (statistics as any).averageLoss = statistics.grossLosses / statistics.nbLoss;
  } else {
    (statistics as any).averageLoss = 0;
  }

  (statistics as any).avgWin = (statistics as any).averageWin;
  (statistics as any).avgLoss = (statistics as any).averageLoss;
  (statistics as any).riskRewardRatio = (statistics as any).avgLoss > 0 
    ? (statistics as any).avgWin / (statistics as any).avgLoss 
    : 0;

  statistics.winningStreak = maxWinningStreak;

  const tradeAccountNumbers = new Set(filteredTrades.map(trade => trade.accountNumber));

  accounts.forEach(account => {
    if (tradeAccountNumbers.has(account.number)) {
      const payouts = account.payouts || [];
      payouts.forEach(payout => {
        statistics.totalPayouts += payout.amount;
        statistics.nbPayouts++;
      });
    }
  });

  const averageTimeInSeconds = filteredTrades.length > 0 ?
    Math.round(statistics.totalPositionTime / filteredTrades.length) : 0;
  statistics.averagePositionTime = parsePositionTime(averageTimeInSeconds);

  if (statistics.grossLosses > 0) {
    statistics.profitFactor = statistics.grossWin / statistics.grossLosses;
  } else if (statistics.grossWin > 0) {
    statistics.profitFactor = Number.POSITIVE_INFINITY;
  } else {
    statistics.profitFactor = 0;
  }

  if (statistics.profitFactor !== Number.POSITIVE_INFINITY) {
    statistics.profitFactor = Math.round(statistics.profitFactor * 100) / 100;
  }

  return statistics;
}

export function formatCalendarData(trades: Trade[], accounts: Account[] = [], timezone: string = 'UTC', preGrouped?: GroupedTrade[]) {
  const groupedTrades = preGrouped ?? groupTradesByExecution(trades)

  const accountMap = new Map(accounts.map(account => [account.number, account]));

  const filteredTrades = groupedTrades;

  return filteredTrades.reduce((acc: any, trade: Trade) => {
    const entryTimestamp = getTradeEntryTimestamp(trade as any) ?? new Date(trade.entryDate)
    const date = formatInTimeZone(entryTimestamp, timezone, 'yyyy-MM-dd')

    if (!acc[date]) {
      acc[date] = {
        pnl: 0,
        tradeNumber: 0,
        longNumber: 0,
        shortNumber: 0,
        dailyRMultiple: 0,
        trades: []
      }
    }
    acc[date].tradeNumber++
    acc[date].pnl += getTradeNetPnl(trade);
    acc[date].dailyRMultiple += calculateTradeRMultiple(trade as any)

    const isLong = trade.side
      ? (trade.side.toLowerCase() === 'long' || trade.side.toLowerCase() === 'buy' || trade.side.toLowerCase() === 'b')
      : (new Date(trade.entryDate).getTime() < new Date(trade.closeDate).getTime())

    acc[date].longNumber += isLong ? 1 : 0
    acc[date].shortNumber += isLong ? 0 : 1
    acc[date].trades.push(trade)
    return acc
  }, {})
}

function groupBy<T>(array: T[], key: keyof T): { [key: string]: T[] } {
  return array.reduce((result, currentValue) => {
    (result[currentValue[key] as string] = result[currentValue[key] as string] || []).push(
      currentValue
    );
    return result;
  }, {} as { [key: string]: T[] });
}

export function generateTradeHash(trade: Partial<Trade>): string {
  return buildTradeIdentityKey(trade as any)
}
