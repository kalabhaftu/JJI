import pino from 'pino'
import { shouldIgnoreError } from '@/lib/observability/error-policy'

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})

const logger = pinoLogger as pino.Logger


export { logger, shouldIgnoreError }
export default logger

