import { z } from 'zod'

export const tradeEntryFormSchema = z.object({
  instrument: z.string().min(1, 'Instrument is required'),
  accountNumber: z.string().min(1, 'Account is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  side: z.enum(['LONG', 'SHORT']),
  entryPrice: z.string().min(1, 'Entry price is required'),
  closePrice: z.string().min(1, 'Close price is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  entryTime: z.string().min(1, 'Entry time is required'),
  closeDate: z.string().min(1, 'Close date is required'),
  closeTime: z.string().min(1, 'Close time is required'),
  pnl: z.number().default(0),
  commission: z.number().default(0),
  stopLoss: z.string().optional(), takeProfit: z.string().optional(), session: z.string().optional(),
  bias: z.string().optional(), tradeType: z.string().optional(), emotionalState: z.string().optional(),
  comment: z.string().optional(), isMissedTrade: z.boolean().default(false), mae: z.string().optional(), mfe: z.string().optional(),
})

export type TradeEntryFormValues = z.input<typeof tradeEntryFormSchema>
