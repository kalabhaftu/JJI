import type { TradeType } from '@/lib/db/schema/trades';
import type { AccountType } from '@/lib/db/schema/accounts';

import {
  getBalanceByMode,
  getTradeFees,
  getTradeGrossPnl,
  getTradeNetPnl,
  normalizePnlDisplayMode,
  type PnlDisplayMode,
} from '@/lib/metrics/pnl'

export interface BalanceCalculationOptions {
  excludeFailedAccounts?: boolean
  includePayouts?: boolean
  pnlDisplayMode?: PnlDisplayMode
}

export interface BalanceResult {
  startingBalance: number
  currentBalance: number
  currentGrossBalance: number
  totalPnL: number
  grossPnL: number
  totalFees: number
  totalCommissions: number
  netPnL: number
  displayPnL: number
  displayBalance: number
  pnlDisplayMode: PnlDisplayMode
  changeAmount: number
  changePercent: number
}

interface DailyBalancePoint {
  date: string
  balance: number
  dailyPnL: number
  change: number
  changePercent: number
  trades: number
  wins: number
  losses: number
}

export function calculateAccountBalance(
  account: AccountType | any,
  trades: (TradeType | any)[],
  transactions: any[] = [],
  options: BalanceCalculationOptions = {}
): number {
  const {
    excludeFailedAccounts = true,
    includePayouts = true
  } = options

  let balance = Number(account.startingBalance) || 0


  let relevantTrades: (TradeType | any)[]

  if (account.accountType === 'prop-firm') {

    relevantTrades = trades.filter(trade => {
      if (trade.phaseAccountId) {
        return trade.phaseAccountId === account.id
      }
      return trade.accountNumber === account.number
    })
  } else {

    relevantTrades = trades.filter(trade => trade.accountNumber === account.number)
  }


  const cumulativePnL = relevantTrades.reduce((sum, trade) => {
    return sum + getTradeNetPnl(trade)
  }, 0)

  balance += cumulativePnL


  if (account.accountType === 'live' && transactions.length > 0) {
    const accountTransactions = transactions.filter(tx => tx.accountId === account.id)
    const totalTransactions = accountTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    balance += totalTransactions
  }


  if (includePayouts && account.payouts && Array.isArray(account.payouts)) {
    const payoutsSum = account.payouts.reduce((sum: number, payout: any) => {
      return sum + (payout.amount || 0)
    }, 0)
    balance += payoutsSum
  }

  return balance
}


export function calculateAccountBalances(
  accounts: (AccountType | any)[],
  allTrades: (TradeType | any)[],
  allTransactions: any[] = [],
  options: BalanceCalculationOptions = {}
): Map<string, number> {
  const balanceMap = new Map<string, number>()


  const tradesByAccountNumber = new Map<string, any[]>()
  const tradesByPhaseId = new Map<string, any[]>()

  allTrades.forEach(trade => {

    if (trade.accountNumber) {
      if (!tradesByAccountNumber.has(trade.accountNumber)) {
        tradesByAccountNumber.set(trade.accountNumber, [])
      }
      tradesByAccountNumber.get(trade.accountNumber)!.push(trade)
    }


    if (trade.phaseAccountId) {
      if (!tradesByPhaseId.has(trade.phaseAccountId)) {
        tradesByPhaseId.set(trade.phaseAccountId, [])
      }
      tradesByPhaseId.get(trade.phaseAccountId)!.push(trade)
    }
  })


  const transactionsByAccountId = new Map<string, any[]>()
  allTransactions.forEach(transaction => {
    if (!transactionsByAccountId.has(transaction.accountId)) {
      transactionsByAccountId.set(transaction.accountId, [])
    }
    transactionsByAccountId.get(transaction.accountId)!.push(transaction)
  })


  const accountsByMasterId = new Map<string, any[]>()
  accounts.forEach(account => {
    if (account.accountType === 'prop-firm' && account.currentPhaseDetails?.masterAccountId) {
      const masterId = account.currentPhaseDetails.masterAccountId
      if (!accountsByMasterId.has(masterId)) {
        accountsByMasterId.set(masterId, [])
      }
      accountsByMasterId.get(masterId)!.push(account)
    }
  })


  accounts.forEach(account => {
    let accountTrades: any[] = []

    if (account.accountType === 'prop-firm') {
    accountTrades = tradesByPhaseId.get(account.id) || []

      if (accountTrades.length === 0 && account.number) {
        accountTrades = tradesByAccountNumber.get(account.number) || []
      }
    } else {
      accountTrades = tradesByAccountNumber.get(account.number) || []
    }

    const accountTransactions = transactionsByAccountId.get(account.id) || []
    const balance = calculateAccountBalance(account, accountTrades, accountTransactions, options)
    balanceMap.set(account.number, balance)
  })

  return balanceMap
}

function calculateTotalEquity(
  accounts: (AccountType | any)[],
  allTrades: (TradeType | any)[],
  allTransactions: any[] = [],
  options: BalanceCalculationOptions = {}
): number {
  const balances = calculateAccountBalances(accounts, allTrades, allTransactions, options)
  return Array.from(balances.values()).reduce((sum, balance) => sum + balance, 0)
}


export function calculateTotalStartingBalance(
  accounts: (AccountType | any)[]
): number {

  const masterAccountBalances = new Map<string, { balance: number, isActive: boolean, isFunded: boolean, status: string }>()


  accounts.forEach(account => {


    const phaseDetails = account.currentPhaseDetails || account.phaseDetails
    const masterKey = phaseDetails?.masterAccountId || account.id
    const accountName = phaseDetails?.masterAccountName || account.name || account.number

    const isActive = account.status === 'active'
    const isFunded = account.status === 'funded'
    const status = account.status || 'active'

    const balance = Number(account.startingBalance) || 0


    const existing = masterAccountBalances.get(masterKey)


    if (existing) {


      if (isFunded) {
        masterAccountBalances.set(masterKey, { balance, isActive, isFunded, status })
      } else if (isActive && !existing.isFunded) {
        masterAccountBalances.set(masterKey, { balance, isActive, isFunded, status })
      } else {
      }

    } else {
    masterAccountBalances.set(masterKey, { balance, isActive, isFunded, status })
    }
  })

  const total = Array.from(masterAccountBalances.values()).reduce((sum, { balance }) => sum + balance, 0)

  return total
}


export function calculateBalanceInfo(
  accounts: (AccountType | any)[],
  trades: (TradeType | any)[],
  transactions: any[] = [],
  options: BalanceCalculationOptions = {}
): BalanceResult {
  const pnlDisplayMode = normalizePnlDisplayMode(options.pnlDisplayMode)

  const startingBalance = calculateTotalStartingBalance(accounts)


  const totalPnL = trades.reduce((sum, trade) => sum + getTradeGrossPnl(trade), 0)
  const totalCommissions = trades.reduce((sum, trade) => sum + getTradeFees(trade), 0)
  const netPnL = trades.reduce((sum, trade) => sum + getTradeNetPnl(trade), 0)
  const liveAccountIds = new Set(
    accounts
      .filter((account) => account?.accountType === 'live')
      .map((account) => account?.id)
      .filter(Boolean)
  )
  const transactionDelta = transactions.reduce((sum, tx) => {
    if (!liveAccountIds.has(tx?.accountId)) return sum
    const amount = Number(tx?.amount)
    return Number.isFinite(amount) ? sum + amount : sum
  }, 0)

  const currentBalance = startingBalance + netPnL + transactionDelta
  const currentGrossBalance = startingBalance + totalPnL + transactionDelta
  const displayPnL = pnlDisplayMode === 'gross' ? totalPnL : netPnL
  const displayBalance = getBalanceByMode(startingBalance, totalPnL, netPnL, pnlDisplayMode) + transactionDelta
  const changeAmount = currentBalance - startingBalance
  const changePercent = startingBalance > 0 ? (changeAmount / startingBalance) * 100 : 0

  return {
    startingBalance,
    currentBalance,
    currentGrossBalance,
    totalPnL,
    grossPnL: totalPnL,
    totalFees: totalCommissions,
    totalCommissions,
    netPnL,
    displayPnL,
    displayBalance,
    pnlDisplayMode,
    changeAmount,
    changePercent
  }
}


function calculateBalanceHistory(
  accounts: (AccountType | any)[],
  trades: (TradeType | any)[],
  calendarData: Record<string, { pnl: number, trades?: any[] }>
): DailyBalancePoint[] {
  const startingBalance = calculateTotalStartingBalance(accounts)


  const sortedDates = Object.keys(calendarData).sort()

  let runningBalance = startingBalance
  let previousBalance = startingBalance

  return sortedDates.map(date => {
    const dayData = calendarData[date]
    const dailyPnL = dayData?.pnl || 0

    runningBalance += dailyPnL
    const change = runningBalance - previousBalance
    const changePercent = previousBalance !== 0 ? (change / Math.abs(previousBalance)) * 100 : 0


    const dayTrades = dayData?.trades || []
    const wins = dayTrades.filter(t => {
      const netPnL = getTradeNetPnl(t)
      return netPnL > 0
    }).length
    const losses = dayTrades.filter(t => {
      const netPnL = getTradeNetPnl(t)
      return netPnL < 0
    }).length

    const point: DailyBalancePoint = {
      date,
      balance: runningBalance,
      dailyPnL,
      change,
      changePercent,
      trades: dayTrades.length,
      wins,
      losses
    }

    previousBalance = runningBalance
    return point
  })
}

