import { z } from 'zod'

const nullableText = (max: number) => z.string().max(max).nullable().optional()
const nullableNumber = z.number().finite().nullable().optional()
const imageReference = nullableText(2_048)

const previewTransformSchema = z.object({
  zoom: z.number().finite().min(0.1).max(10),
  x: z.number().finite().min(-10_000).max(10_000),
  y: z.number().finite().min(-10_000).max(10_000),
}).strict()

export const tradeUpdateSchema = z.object({
  comment: nullableText(50_000),
  groupId: nullableText(256),
  cardPreviewImage: imageReference,
  cardPreviewTransform: previewTransformSchema.nullable().optional(),
  imageOne: imageReference,
  imageTwo: imageReference,
  imageThree: imageReference,
  imageFour: imageReference,
  imageFive: imageReference,
  imageSix: imageReference,
  modelId: nullableText(256),
  selectedRules: z.array(z.string().max(1_000)).max(200).nullable().optional(),
  tags: z.array(z.string().max(256)).max(200).optional(),
  marketBias: z.enum(['BULLISH', 'BEARISH', 'UNDECIDED']).nullable().optional(),
  newsDay: z.boolean().optional(),
  selectedNews: nullableText(10_000),
  newsTraded: z.boolean().optional(),
  biasTimeframe: nullableText(128),
  narrativeTimeframe: nullableText(128),
  entryTimeframe: nullableText(128),
  structureTimeframe: nullableText(128),
  orderType: nullableText(128),
  chartLinks: nullableText(10_000),
  chartLinksList: z.array(z.string().max(2_048)).max(20).optional(),
  outcome: z.enum([
    'GOOD_WIN',
    'BAD_WIN',
    'GOOD_BE',
    'BAD_BE',
    'BREAKEVEN',
    'GOOD_LOSS',
    'BAD_LOSS',
  ]).nullable().optional(),
  ruleBroken: z.boolean().optional(),
  closeReason: nullableText(1_000),
  stopLoss: nullableText(128),
  stopLossValue: nullableNumber,
  takeProfit: nullableText(128),
  takeProfitValue: nullableNumber,
  plannedEntry: nullableText(128),
  plannedStopLoss: nullableText(128),
  plannedTakeProfit: nullableText(128),
  plannedSize: nullableNumber,
  planNotes: nullableText(50_000),
  mae: nullableNumber,
  mfe: nullableNumber,
  setup: nullableText(1_000),
}).strict()

export type TradeUpdate = z.infer<typeof tradeUpdateSchema>

export function parseTradeUpdate(input: unknown): TradeUpdate {
  return tradeUpdateSchema.parse(input)
}
