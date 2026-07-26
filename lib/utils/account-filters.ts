export type AccountStatus = 'active' | 'failed' | 'funded' | 'passed' | 'pending' | null

export interface AccountWithStatus {
  status?: AccountStatus | null
  [key: string]: any
}

export function isAccountActive(account: AccountWithStatus): boolean {
  if (account.status === 'failed' || account.status === 'passed') {
    return false
  }
  
  return true
}

export function getActiveAccountStatuses(): AccountStatus[] {
  return ['active', 'funded']
}

export function getInactiveAccountStatuses(): AccountStatus[] {
  return ['failed', 'passed']
}

export function filterActiveAccounts<T extends AccountWithStatus>(accounts: T[]): T[] {
  return accounts.filter(isAccountActive)
}

/**
 * Get Prisma where clause to exclude inactive accounts (failed and passed)
 * Use this in database queries to automatically exclude inactive accounts
 */
export function getActiveAccountsWhereClause(additionalWhere: any = {}) {
  return {
    ...additionalWhere,
    status: {
      in: ['active', 'funded']
    }
  }
}

/**
 * Check if trades should be included based on account status
 * Only include trades from active accounts
 */
export function shouldIncludeTradeByAccount(accountNumber: string, accounts: AccountWithStatus[]): boolean {
  const account = accounts.find(acc => acc.number === accountNumber)
  return account ? isAccountActive(account) : true // Include if account not found (legacy trades)
}

/**
 * Filter trades to only include those from active accounts
 */
export function filterTradesFromActiveAccounts<T extends { accountNumber: string }>(
  trades: T[], 
  accounts: AccountWithStatus[]
): T[] {
  return trades.filter(trade => shouldIncludeTradeByAccount(trade.accountNumber, accounts))
}
