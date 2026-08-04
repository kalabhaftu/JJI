'use client'

import { Spinner } from '@/components/ui/spinner'

import { Button } from '@/components/ui/button'
import { TradeWorkspace, TradeWorkspaceCloseButton, type TradeWorkspaceProps } from '@/components/ui/trade-workspace'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useTags } from '@/context/tags-provider'
import { useData } from '@/context/data-provider'
import { useNewsEvents } from '@/hooks/use-news-events'
import { useTradingModels } from '@/hooks/use-trading-models'
import { uploadService } from '@/lib/upload-service'
import { useUserStore } from '@/store/user-store'
import { ExtendedTrade, MarketBias, TradeOutcome } from '@/types/trade-extended'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, PenLine, Route, Newspaper } from 'lucide-react'
import type { TradeType } from '@/lib/db/schema/trades';

import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { z } from 'zod'
import { TradeNewsTab } from './components/trade-news-tab'
import { TradeNotesTab } from './components/trade-notes-tab'
import { TradeStrategyTab } from './components/trade-strategy-tab'
import { cn } from '@/lib/utils'
import {
  classifyTrade,
  formatCurrency,
} from '@/lib/trading/trade-formatting'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { parseTradePreviewImageValue } from '@/lib/trade-preview-image'
import {
  DEFAULT_TRADE_PREVIEW_TRANSFORM,
  normalizeTradePreviewTransform,
  type TradePreviewTransform,
} from '@/lib/trade-preview'
import { getTradeNetPnl, getTradePnlByMode, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { parseTradeChartLinks, serializeTradeChartLinks } from '@/lib/trade-core'

interface TradeEditPanelProps {
  trade: ExtendedTrade
  onClose: () => void
  onSave: (updatedTrade: Partial<TradeType>) => Promise<void>
  workspaceMode?: TradeWorkspaceProps['mode']
}

const editTradeSchema = z.object({
  comment: z.string().optional(),
  cardPreviewImage: z.string().optional(),
  cardPreviewTransform: z.object({
    zoom: z.number(),
    x: z.number(),
    y: z.number(),
  }).nullable().optional(),
  imageOne: z.string().optional(),
  imageTwo: z.string().optional(),
  imageThree: z.string().optional(),
  imageFour: z.string().optional(),
  imageFive: z.string().optional(),
  imageSix: z.string().optional(),
  modelId: z.string().nullable().optional(),
  selectedRules: z.array(z.string()).optional(),
  marketBias: z.enum(['BULLISH', 'BEARISH', 'UNDECIDED']).nullable().optional(),
  newsDay: z.boolean().optional(),
  selectedNews: z.array(z.string()).optional(),
  newsTraded: z.boolean().optional(),
  biasTimeframe: z.string().nullable().optional(),
  narrativeTimeframe: z.string().nullable().optional(),
  entryTimeframe: z.string().nullable().optional(),
  structureTimeframe: z.string().nullable().optional(),
  orderType: z.string().nullable().optional(),
  chartLinks: z.array(z.string()).optional(),
})

type EditTradeFormData = z.infer<typeof editTradeSchema>

interface Rule {
  text: string
  category: 'entry' | 'exit' | 'risk' | 'general'
}

interface LocalTradingModel {
  id: string
  name: string
  rules: (string | Rule)[]
  notes?: string | null
}

export function TradeEditPanel({ trade, onClose, onSave, workspaceMode = 'route' }: TradeEditPanelProps) {
  const { statistics } = useData()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initializedTradeKeyRef = useRef<string | null>(null)
  const { tradingModels: fetchedModels } = useTradingModels()
  const tradingModels = React.useMemo(
    () => (Array.isArray(fetchedModels) ? fetchedModels : []) as LocalTradingModel[],
    [fetchedModels]
  )
  const tradingModelsKey = React.useMemo(
    () => tradingModels.map(m => m.id).join(','),
    [tradingModels]
  )
  const { newsEvents: allNewsEvents } = useNewsEvents()
  const [selectedModel, setSelectedModel] = useState<LocalTradingModel | null>(null)
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isNewsDay, setIsNewsDay] = useState(false)
  const [selectedNewsEvents, setSelectedNewsEvents] = useState<string[]>([])
  const [newsTraded, setNewsTraded] = useState(false)
  const [marketBias, setMarketBias] = useState<MarketBias | null>(null)
  const [tradeOutcome, setTradeOutcome] = useState<TradeOutcome | null>(null)
  const [ruleBroken, setRuleBroken] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState('details')
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [newsSearchQuery, setNewsSearchQuery] = useState('')
  const [comment, setComment] = useState('')
  const [biasTimeframe, setBiasTimeframe] = useState<string | null>(null)
  const [narrativeTimeframe, setNarrativeTimeframe] = useState<string | null>(null)
  const [entryTimeframe, setEntryTimeframe] = useState<string | null>(null)
  const [structureTimeframe, setStructureTimeframe] = useState<string | null>(null)
  const [orderType, setOrderType] = useState<string | null>(null)
  const [chartLinks, setChartLinks] = useState<string[]>(['', '', '', ''])
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const pnlDisplayMode = normalizePnlDisplayMode(
    useUserStore(state => state.user?.pnlDisplayMode)
  )
  const { tags } = useTags()

  const { control, handleSubmit, setValue, watch, reset, formState: { isDirty } } = useForm<EditTradeFormData>({
    resolver: zodResolver(editTradeSchema),
    defaultValues: {
      comment: '',
      cardPreviewImage: '',
      cardPreviewTransform: { ...DEFAULT_TRADE_PREVIEW_TRANSFORM },
      imageOne: '', imageTwo: '', imageThree: '',
      imageFour: '', imageFive: '', imageSix: '',
      modelId: null,
      selectedRules: [],
      marketBias: null,
      newsDay: false,
      selectedNews: [],
      newsTraded: false,
      biasTimeframe: null, narrativeTimeframe: null,
      entryTimeframe: null, structureTimeframe: null,
      orderType: null,
      chartLinks: [],
    }
  })

  const watchedValues = watch()


  useEffect(() => {
    if (!trade || isSubmitting) return
    const initializationKey = `${trade.id}:${tradingModelsKey}`
    if (initializedTradeKeyRef.current === initializationKey) return
    initializedTradeKeyRef.current = initializationKey

      setImageErrors({})
      const tagIds = Array.isArray(trade.tags) ? trade.tags : []
      setSelectedTags(tagIds)

      const newsIds = (trade as any).selectedNews ? (trade as any).selectedNews.split(',').filter(Boolean) : []
      setSelectedNewsEvents(newsIds)
      setIsNewsDay((trade as any).newsDay || false)
      setNewsTraded((trade as any).newsTraded || false)

      setMarketBias(trade.marketBias || null)
      setBiasTimeframe((trade as any).biasTimeframe || null)
      setNarrativeTimeframe((trade as any).narrativeTimeframe || null)
      setEntryTimeframe((trade as any).entryTimeframe || null)
      setStructureTimeframe((trade as any).structureTimeframe || null)
      setOrderType((trade as any).orderType || null)

      const links = parseTradeChartLinks(trade as any)
      setChartLinks(links.length > 0 ? links : ['', '', '', ''])

      const modelId = (trade as any).modelId
      if (modelId) {
        const model = tradingModels.find(m => m.id === modelId)
        setSelectedModel(model || null)
        setSelectedRules(trade.selectedRules || [])
      }

      const imageFields = {
        cardPreviewImage: parseTradePreviewImageValue((trade as any).cardPreviewImage).src || '',
        cardPreviewTransform: (trade as any).cardPreviewImage
          ? normalizeTradePreviewTransform(
              (trade as any).cardPreviewTransform ?? DEFAULT_TRADE_PREVIEW_TRANSFORM
            )
          : null,
        imageOne: (trade as any).imageOne || '',
        imageTwo: (trade as any).imageTwo || '',
        imageThree: (trade as any).imageThree || '',
        imageFour: (trade as any).imageFour || '',
        imageFive: (trade as any).imageFive || '',
        imageSix: (trade as any).imageSix || '',
      }

      reset({
        comment: (trade as any).comment || '',
        ...imageFields,
        modelId: modelId || null,
        selectedRules: (trade as any).selectedRules || [],
        marketBias: (trade as any).marketBias || null,
        newsDay: (trade as any).newsDay || false,
        selectedNews: newsIds,
        newsTraded: (trade as any).newsTraded || false,
        biasTimeframe: (trade as any).biasTimeframe || null,
        narrativeTimeframe: (trade as any).narrativeTimeframe || null,
        entryTimeframe: (trade as any).entryTimeframe || null,
        structureTimeframe: (trade as any).structureTimeframe || null,
        orderType: (trade as any).orderType || null,
        chartLinks: links,
      })

      setComment((trade as any).comment || '')
      setTradeOutcome((trade as any).outcome || null)
      setRuleBroken((trade as any).ruleBroken || false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade, reset, tradingModelsKey, isSubmitting])

  const filteredNewsEvents = React.useMemo(() => {
    if (!newsSearchQuery.trim()) return allNewsEvents
    const query = newsSearchQuery.toLowerCase()
    return allNewsEvents.filter(event =>
      event.name.toLowerCase().includes(query) ||
      event.country.toLowerCase().includes(query) ||
      event.category.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query))
    )
  }, [newsSearchQuery, allNewsEvents])

  const handleImageUpload = async (
    field: 'cardPreviewImage' | 'imageOne' | 'imageTwo' | 'imageThree' | 'imageFour' | 'imageFive' | 'imageSix',
    file: File
  ) => {
    try {
      const currentUser = supabaseUser || user
      if (!currentUser?.id) { toast.error('User not authenticated'); return }
      setUploadingField(field)
      let fileToUpload = file
      if (field === 'cardPreviewImage') {
        try {
          const imageCompression = (await import('browser-image-compression')).default
          fileToUpload = await imageCompression(file, {
            maxWidthOrHeight: 1920, useWebWorker: true,
            fileType: 'image/webp', initialQuality: 0.95,
          })
        } catch (err) { }
      }
      const result = await uploadService.uploadImage(fileToUpload, {
        userId: currentUser.id, folder: 'trades', tradeId: (trade as any)?.id,
      })
      if (!result.success || !result.url) throw new Error(result.error || 'Upload failed')
      setValue(field, result.url, { shouldDirty: true })
      if (field === 'cardPreviewImage') {
        setValue('cardPreviewTransform', { ...DEFAULT_TRADE_PREVIEW_TRANSFORM }, { shouldDirty: true })
      }
      setImageErrors(prev => { const n = { ...prev }; delete n[field]; return n })
      toast.success('Image uploaded successfully')
    } catch (error) {
      reportClientError(error, { operation: 'upload-trade-image', route: '/dashboard/journal' })
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploadingField(null)
    }
  }

  const onSubmit = async (data: EditTradeFormData) => {
    if (!trade) return
    setIsSubmitting(true)
    try {
      const updateData = {
        comment: data.comment || null,
        modelId: data.modelId || null,
        selectedRules: selectedRules.length > 0 ? selectedRules : null,
        tags: selectedTags.length > 0 ? selectedTags : [],
        cardPreviewImage: parseTradePreviewImageValue(data.cardPreviewImage).src || null,
        cardPreviewTransform: data.cardPreviewImage
          ? normalizeTradePreviewTransform(data.cardPreviewTransform)
          : null,
        imageOne: data.imageOne || null,
        imageTwo: data.imageTwo || null,
        imageThree: data.imageThree || null,
        imageFour: data.imageFour || null,
        imageFive: data.imageFive || null,
        imageSix: data.imageSix || null,
        marketBias: marketBias,
        newsDay: isNewsDay,
        selectedNews: selectedNewsEvents.length > 0 ? selectedNewsEvents.join(',') : null,
        newsTraded: newsTraded,
        biasTimeframe, narrativeTimeframe, entryTimeframe, structureTimeframe,
        orderType,
        outcome: tradeOutcome,
        ruleBroken,
        ...serializeTradeChartLinks(chartLinks),
      } as any
      await onSave(updateData)
      toast.success('Trade updated successfully')
      onClose()
    } catch (error) {
      reportClientError(error, { operation: 'update-trade', route: '/dashboard/journal' })
      toast.error(error instanceof Error ? error.message : 'Failed to update trade')
    } finally {
      setIsSubmitting(false)
    }
  }

  const tradeData = trade as any
  const threshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const netPnL = getTradeNetPnl(trade)
  const displayPnl = getTradePnlByMode(trade, pnlDisplayMode)
  const outcome = classifyTrade(netPnL, threshold)
  const isWin = outcome === 'win'
  const isLoss = outcome === 'loss'
  const isLong = trade.side?.toUpperCase() === 'BUY' || trade.side?.toLowerCase() === 'long'

  return (
    <TradeWorkspace mode={workspaceMode} title={`Edit ${trade.instrument} trade`} description="Update journal, strategy, and news context." dirty={isDirty} onRequestClose={onClose}>
      <div className="flex flex-col h-full">
        {}
        <div className="px-4 sm:px-6 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <TradeWorkspaceCloseButton variant="ghost" size="sm" disabled={isSubmitting} className="h-8 px-2 text-xs hover:bg-accent/50 shrink-0">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </TradeWorkspaceCloseButton>
              <div className="h-4 w-px bg-border/40 shrink-0" />
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">{tradeData.instrument}</h2>
              <Badge variant={isLong ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 h-5 uppercase font-bold shrink-0">
                {isLong ? 'Buy' : 'Sell'}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-mono font-bold px-2 py-0 h-5 shrink-0",
                  displayPnl >= 0 ? "border-long/40 text-long bg-long/5" : displayPnl < 0 ? "border-short/40 text-short bg-short/5" : "border-border text-muted-foreground"
                )}
              >
                {formatCurrency(displayPnl)}
              </Badge>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hidden sm:inline shrink-0">Editing</span>
          </div>
        </div>

        {}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <TabsList className="w-full sm:w-auto justify-start h-auto p-1 gap-1 bg-muted/50">
              <TabsTrigger value="details" className="text-xs px-3 py-1.5 h-auto gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Notes & Images
              </TabsTrigger>
              <TabsTrigger value="strategy" className="text-xs px-3 py-1.5 h-auto gap-1.5">
                <Route className="h-3.5 w-3.5" />
                Strategy
              </TabsTrigger>
              <TabsTrigger value="news" className="text-xs px-3 py-1.5 h-auto gap-1.5">
                <Newspaper className="h-3.5 w-3.5" />
                News
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6">
            <div className="py-4 max-w-5xl mx-auto">
              <TabsContent value="details" className="mt-0 space-y-6 px-1">
                <TradeNotesTab
                  control={control as any}
                  cardPreviewImage={watchedValues.cardPreviewImage || null}
                  cardPreviewTransform={watchedValues.cardPreviewTransform ?? null}
                  onPreviewTransformChange={(transform) => {
                    setValue('cardPreviewTransform', transform as TradePreviewTransform, { shouldDirty: true })
                  }}
                  images={{
                    imageOne: watchedValues.imageOne || null,
                    imageTwo: watchedValues.imageTwo || null,
                    imageThree: watchedValues.imageThree || null,
                    imageFour: watchedValues.imageFour || null,
                    imageFive: watchedValues.imageFive || null,
                    imageSix: watchedValues.imageSix || null,
                  }}
                  onUpload={(field, file) => handleImageUpload(field as any, file)}
                  onRemove={(field) => {
                    setValue(field as any, '', { shouldDirty: true })
                    if (field === 'cardPreviewImage') {
                      setValue('cardPreviewTransform', null, { shouldDirty: true })
                    }
                    setImageErrors(prev => { const n = { ...prev }; delete n[field]; return n })
                  }}
                  imageErrors={imageErrors}
                  setImageError={(field, hasError) => setImageErrors(prev => ({ ...prev, [field]: hasError }))}
                  uploadingField={uploadingField}
                  chartLinks={chartLinks}
                  setChartLinks={setChartLinks}
                  isSubmitting={isSubmitting}
                />
              </TabsContent>

              <TabsContent value="strategy" className="mt-0 space-y-6 px-1">
                <TradeStrategyTab
                  marketBias={marketBias}
                  setMarketBias={setMarketBias}
                  orderType={orderType}
                  setOrderType={setOrderType}
                  selectedModelId={watchedValues.modelId || null}
                  setModelId={(id) => {
                    setValue('modelId', id, { shouldDirty: true })
                    const model = tradingModels.find(m => m.id === id)
                    setSelectedModel(model || null)
                    if (id !== watchedValues.modelId) setSelectedRules([])
                  }}
                  tradingModels={tradingModels}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  selectedRules={selectedRules}
                  setSelectedRules={setSelectedRules}
                  selectedTags={selectedTags}
                  setSelectedTags={setSelectedTags}
                  tradeOutcome={tradeOutcome}
                  setTradeOutcome={setTradeOutcome}
                  ruleBroken={ruleBroken}
                  setRuleBroken={setRuleBroken}
                />
              </TabsContent>

              <TabsContent value="news" className="mt-0 space-y-6 px-1">
                <TradeNewsTab
                  isNewsDay={isNewsDay}
                  setIsNewsDay={(val) => {
                    setIsNewsDay(val)
                    if (!val) { setSelectedNewsEvents([]); setNewsTraded(false) }
                  }}
                  newsSearchQuery={newsSearchQuery}
                  setNewsSearchQuery={setNewsSearchQuery}
                  filteredNewsEvents={filteredNewsEvents}
                  selectedNewsEvents={selectedNewsEvents}
                  setSelectedNewsEvents={setSelectedNewsEvents}
                  newsTraded={newsTraded}
                  setNewsTraded={setNewsTraded}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {}
        <div className="px-4 sm:px-6 py-3 border-t border-border/40 shrink-0 flex flex-col-reverse sm:flex-row gap-2 items-center justify-between bg-muted/5">
          <TradeWorkspaceCloseButton variant="outline" disabled={isSubmitting} className="w-full sm:w-auto h-9 px-5 rounded-xl text-xs">
            Cancel
          </TradeWorkspaceCloseButton>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="w-full sm:w-auto h-9 px-5 rounded-xl shadow-lg shadow-primary/10 font-semibold text-xs">
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

    </TradeWorkspace>
  )
}
