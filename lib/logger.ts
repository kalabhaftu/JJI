import pino from 'pino'
import { shouldIgnoreError } from '@/lib/observability/error-policy'

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})

const logger = pinoLogger as pino.Logger

// Named re-exports so both `import logger from '@/lib/logger'`
// and `import { logger } from '@/lib/logger'` work seamlessly.
export { logger, shouldIgnoreError }
export default logger
