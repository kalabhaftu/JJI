'use client'

import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import type { TradeType } from '@/lib/db/schema/trades';

import { 
  processUniversalCSV, 
  SUPPORTED_PLATFORMS,
  type ProcessingResult 
} from '@/lib/csv/universal-csv-processor'

interface UniversalProcessorProps {
  csvData: string[][]
  headers: string[]
  setProcessedTrades: React.Dispatch<React.SetStateAction<TradeType[]>>
  accountNumber: string
}
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Sparkles,
  FileSpreadsheet,
  Wand2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const formatDuration = (seconds: number): string => {
  if (seconds === 0) return '0s'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`)
  
  return parts.join(' ')
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export default function UniversalProcessor({ 
  headers, 
  csvData, 
  setProcessedTrades,
  accountNumber 
}: UniversalProcessorProps) {
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const [isUsingAI, setIsUsingAI] = useState(false)
  const [aiProcessingState, setAiProcessingState] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle')


  const processWithAI = useCallback(async () => {
    if (csvData.length === 0) return
    
    setIsUsingAI(true)
    setAiProcessingState('processing')
    
    try {
      const response = await fetch('/api/v1/ai/format-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          rows: csvData.slice(0, 100)
        })
      })

      if (!response.ok) throw new Error('AI processing failed')
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let fullText = ''
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }


      const jsonMatch = fullText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const trades = JSON.parse(jsonMatch[0])
        const formattedTrades = trades.map((trade: any, idx: number) => ({
          ...trade,
          id: `ai-${Date.now()}-${idx}`,
          userId: '',
          accountId: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
        
        setProcessedTrades(formattedTrades as TradeType[])
        setProcessingResult({
          success: true,
          trades: formattedTrades,
          detectedPlatform: 'AI-Processed',
          mappedFields: {
            instrument: 'AI-detected',
            side: 'AI-detected',
            quantity: 'AI-detected',
            entryPrice: 'AI-detected',
            closePrice: 'AI-detected',
            entryDate: 'AI-detected',
            closeDate: 'AI-detected',
            pnl: 'AI-detected',
            commission: 'AI-detected',
            stopLoss: null,
            takeProfit: null,
            swap: null,
            timeInPosition: 'AI-detected',
            ticket: null
          },
          missingRequiredFields: [],
          warnings: [],
          errors: [],
          stats: {
            totalRows: csvData.length,
            processedRows: formattedTrades.length,
            skippedRows: csvData.length - formattedTrades.length,
            tradesWithStopLoss: 0,
            tradesWithTakeProfit: 0,
            tradesWithCommission: formattedTrades.length
          }
        })
        setAiProcessingState('complete')
        toast.success(`AI processed ${formattedTrades.length} trades successfully`)
      } else {
        throw new Error('Could not parse AI response')
      }
    } catch (error) {
      reportClientError(error, { operation: 'process-universal-import-with-ai', route: '/api/v1/import/universal' })
      setAiProcessingState('error')
      toast.error('AI processing failed. Please try the CSV-AI option with manual column mapping.')
    }
  }, [csvData, headers, setProcessedTrades])

  const processTrades = useCallback(() => {
    const result = processUniversalCSV(headers, csvData, {
      fallbackTimezone: 'America/New_York',
      skipEmptyRows: true,
      requirePnl: false
    })
    
    setProcessingResult(result)
    

    if (!result.success || result.trades.length === 0) {

      if (!isUsingAI && csvData.length > 0) {
        toast.info('Auto-detection unsuccessful. Switching to AI processing...')
        processWithAI()
        return
      }
    }
    
    setProcessedTrades(result.trades as TradeType[])
  }, [csvData, headers, setProcessedTrades, isUsingAI, processWithAI])

  useEffect(() => {
    processTrades()
  }, [processTrades])

  const processedTrades = useMemo(() => {
    const trades = (processingResult?.trades as TradeType[]) || []
    return trades.map((trade) => ({
      ...trade,
      id: crypto.randomUUID(),
      accountNumber: trade.accountNumber || accountNumber,
      symbol: trade.symbol || trade.instrument,
      entryTime: trade.entryTime || (trade.entryDate ? new Date(trade.entryDate) : null),
      exitTime: trade.exitTime || (trade.closeDate ? new Date(trade.closeDate) : null),
      pnl: toFiniteNumber(trade.pnl, 0),
      commission: toFiniteNumber(trade.commission, 0),
      quantity: toFiniteNumber(trade.quantity, 1),
      timeInPosition: toFiniteNumber(trade.timeInPosition, 0),
    })) as TradeType[]
  }, [accountNumber, processingResult?.trades])

  useEffect(() => {
    if (processedTrades.length > 0) {
      setProcessedTrades(processedTrades)
    }
  }, [processedTrades, setProcessedTrades])

  const totalPnL = useMemo(() => 
    processedTrades.reduce((sum, trade) => sum + toFiniteNumber(trade.pnl, 0), 0), 
    [processedTrades]
  )
  
  const totalCommission = useMemo(() => 
    processedTrades.reduce((sum, trade) => sum + toFiniteNumber(trade.commission, 0), 0), 
    [processedTrades]
  )
  
  const uniqueInstruments = useMemo(() => 
    Array.from(new Set(processedTrades.map(trade => trade.instrument))), 
    [processedTrades]
  )

  if (!processingResult || aiProcessingState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {aiProcessingState === 'processing' ? (
          <>
            <div className="p-3 rounded-full bg-primary/10">
              <Wand2 className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold">AI Processing Your Trades</p>
              <p className="text-sm text-muted-foreground">Analyzing and formatting your CSV data...</p>
            </div>
          </>
        ) : (
          <Spinner className="h-8 w-8 text-primary" />
        )}
      </div>
    )
  }

  return (
    <Card className="h-full flex flex-col w-full overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b shrink-0 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isUsingAI ? (
              <Wand2 className="h-5 w-5 text-primary" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="text-base">
              {isUsingAI ? 'AI CSV Processor' : 'Universal CSV Processor'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {isUsingAI ? (
              <>Mode: <Badge variant="default" className="ml-1 bg-primary/20 text-primary">AI-Powered</Badge></>
            ) : (
              <>Auto-detected: <Badge variant="secondary" className="ml-1">{processingResult.detectedPlatform || 'Unknown'}</Badge></>
            )}
          </CardDescription>
        </div>
        
        {}
        <div className="flex items-center gap-2">
          {processingResult.success ? (
            <Badge variant="default" className="bg-long/20 text-long border border-long/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {processingResult.stats.processedRows} trades processed
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Processing failed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-auto p-0">
        <div className="flex flex-col h-full">
          
          {}
          {(processingResult.warnings.length > 0 || processingResult.errors.length > 0) && (
            <div className="p-4 space-y-2 border-b">
              {processingResult.errors.map((error, idx) => (
                <div key={`error-${idx}`} className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error.message}</span>
                </div>
              ))}
              {processingResult.warnings.slice(0, 3).map((warning, idx) => (
                <div key={`warning-${idx}`} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 p-2 rounded">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
              {processingResult.warnings.length > 3 && (
                <p className="text-xs text-muted-foreground pl-6">
                  +{processingResult.warnings.length - 3} more warnings
                </p>
              )}
            </div>
          )}

          {}
          <Collapsible open={showFieldMapping} onOpenChange={setShowFieldMapping}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-4 py-2 rounded-none border-b">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-xs">Field Mapping</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {Object.values(processingResult.mappedFields).filter(Boolean).length} / {Object.keys(processingResult.mappedFields).length}
                </Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 bg-muted/30 border-b">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                  {Object.entries(processingResult.mappedFields).map(([field, header]) => (
                    <div key={field} className="flex items-center gap-1.5">
                      {header ? (
                        <CheckCircle2 className="h-3 w-3 text-long shrink-0" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="text-muted-foreground truncate">
                        {header || 'Not found'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {}
          {processedTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
              <h3 className="font-semibold text-lg mb-1">No valid trades found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                We could not validate a trade in this file. Check that it includes Symbol or Instrument and Entry Date, then retry the check.
              </p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => void processWithAI()} disabled={isUsingAI}>
                {isUsingAI ? <Spinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Retry trade check
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <Table className="w-full border-separate border-spacing-0">
                <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs">
                  <TableRow>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Instrument</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Side</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Qty</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Entry</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Exit</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Entry Date</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Exit Date</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">P&L</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Duration</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">Commission</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">SL</TableHead>
                    <TableHead className="whitespace-nowrap px-3 py-2 text-xs font-semibold">TP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedTrades.map((trade) => (
                    <TableRow 
                      key={trade.id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                        {trade.instrument}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm">
                        <Badge 
                          variant="outline" 
                          className={String(trade.side || '').toUpperCase() === 'BUY' || trade.side === 'long' ? 'border-long/50 text-long' : 'border-short/50 text-short'}
                        >
                          {trade.side || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm">
                        {trade.quantity || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm">
                        {trade.entryPrice || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm">
                        {trade.closePrice || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {trade.entryDate ? new Date(trade.entryDate).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {trade.closeDate ? new Date(trade.closeDate).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap px-3 py-2 text-sm font-semibold ${
                        toFiniteNumber(trade.pnl, 0) >= 0 ? 'text-long' : 'text-short'
                      }`}>
                        ${toFiniteNumber(trade.pnl, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {formatDuration(trade.timeInPosition || 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {toFiniteNumber(trade.commission, 0) ? `$${Math.abs(toFiniteNumber(trade.commission, 0)).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {trade.stopLoss || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {trade.takeProfit || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Total P&L</p>
            <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-long' : 'text-short'}`}>
              ${totalPnL.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Commission</p>
            <p className="text-lg font-bold text-muted-foreground">
              ${Math.abs(totalCommission).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Net P&L</p>
            <p className={`text-lg font-bold ${(totalPnL + totalCommission) >= 0 ? 'text-long' : 'text-short'}`}>
              ${(totalPnL + totalCommission).toFixed(2)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Instruments:</span>
          <div className="flex flex-wrap gap-1">
            {uniqueInstruments.slice(0, 5).map((instrument) => (
              <Badge key={instrument} variant="outline" className="text-xs">
                {instrument}
              </Badge>
            ))}
            {uniqueInstruments.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{uniqueInstruments.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

function UniversalProcessorInfo() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Universal CSV Import</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically detects and processes CSV files from any trading platform.
          </p>
        </div>
      </div>
      
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Supported Platforms
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_PLATFORMS.map(platform => (
            <Badge key={platform} variant="secondary" className="text-xs">
              {platform}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="pt-2 border-t">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Required Fields
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-long" />
            Symbol/Instrument (asset name)
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-long" />
            Entry Date/Time (trade open timestamp)
          </li>
        </ul>
        
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-3">
          Optional Fields
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>P&L, Entry/Exit Price, Side, Quantity, Stop Loss, Take Profit, Commission, Duration</li>
        </ul>
      </div>
      
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          <Info className="h-3 w-3 inline mr-1" />
          The processor automatically maps column headers to fields. If your CSV uses non-standard headers, 
          use the CSV-AI option for manual column mapping.
        </p>
      </div>
    </div>
  )
}
