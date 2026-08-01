import 'server-only'

import { reportError } from '@/lib/observability/report-error'

export const safeDbOperation = async <T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await operation()
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'safe-database-operation',
    })
    return fallbackValue
  }
}
