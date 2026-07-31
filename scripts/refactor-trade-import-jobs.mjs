import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../server/trade-import-jobs.ts', import.meta.url)
const outputDirectory = new URL('../server/trade-import-jobs/', import.meta.url)
const source = await readFile(sourcePath, 'utf8')

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  if (start < 0 || end < 0) {
    throw new Error(`Missing trade-import split marker: ${startMarker} -> ${endMarker}`)
  }
  return source.slice(start, end).trim()
}

const types = section('interface TradeImportPayload', 'function parsePayload')
  .replace('interface TradeImportPayload', 'export interface TradeImportPayload')
  .replace('interface TradeImportJobState', 'export interface TradeImportJobState')
  .replace('const DEFAULT_TRADE_IMPORT_STATE', 'export const DEFAULT_TRADE_IMPORT_STATE')
  .replace('function parseTradeImportState', 'export function parseTradeImportState')
const payload = section('function parsePayload', 'function serializeTradeImportJob')
  .replace('function parsePayload', 'export function parseTradeImportPayload')
const serialization = section('function serializeTradeImportJob', 'function normalizeTrade')
  .replace('function serializeTradeImportJob', 'export function serializeTradeImportJob')
const normalization = section('function normalizeTrade', 'async function assertTradeImportTarget')
  .replace('function normalizeTrade', 'export function normalizeTrade')
  .replace('function computeProgress', 'export function computeTradeImportProgress')
const lifecycle = section('async function assertTradeImportTarget', 'export async function processTradeImportJobChunk')
const execution = section('export async function processTradeImportJobChunk')
  .replaceAll('parsePayload(', 'parseTradeImportPayload(')
  .replaceAll('computeProgress(', 'computeTradeImportProgress(')

await mkdir(outputDirectory, { recursive: true })
const files = new Map([
  ['types.ts', `${types}\n\n${serialization}\n`],
  ['normalization.ts', `import { buildTradePersistenceData } from '@/lib/trade-core'
import { generateTradeHash } from '@/lib/trading/trade-grouping'
import type { TradeImportPayload } from '@/server/trade-import-jobs/types'

${payload}

${normalization}
`],
  ['lifecycle.ts', `import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { uploadImportObject } from '@/server/import-object-store'
import {
  DEFAULT_TRADE_IMPORT_STATE,
  serializeTradeImportJob,
  type TradeImportPayload,
} from '@/server/trade-import-jobs/types'

${lifecycle}
`],
  ['execution.ts', `import { and, eq } from 'drizzle-orm'

import { buildBulkAuditSummary } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import logger from '@/lib/logger'
import { getSafeErrorMessage, reportError } from '@/lib/observability/report-error'
import { buildSyntheticExecutionsFromTrade } from '@/lib/trade-core'
import {
  claimImportJob,
  completeClaimedImportJob,
  updateClaimedImportJob,
} from '@/server/import-job-runtime'
import { downloadImportObject } from '@/server/import-object-store'
import {
  computeTradeImportProgress,
  normalizeTrade,
  parseTradeImportPayload,
} from '@/server/trade-import-jobs/normalization'
import {
  parseTradeImportState,
  serializeTradeImportJob,
} from '@/server/trade-import-jobs/types'

const TRADE_IMPORT_CHUNK_SIZE = 250

${execution}
`],
])
for (const [name, content] of files) {
  await writeFile(new URL(name, outputDirectory), content)
}
await writeFile(sourcePath, `export {
  cancelTradeImportJob,
  createTradeImportJob,
  getTradeImportJobForUser,
} from '@/server/trade-import-jobs/lifecycle'
export { processTradeImportJobChunk } from '@/server/trade-import-jobs/execution'
`)
