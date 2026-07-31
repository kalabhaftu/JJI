import React, { useEffect, useState, useCallback } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { X, AlertTriangle, Info, RefreshCw, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { ImportType } from './import-type-selection'
import { mappingSchema } from '@/app/api/v1/ai/mappings/schema'
import { cn } from '@/lib/utils'
import { z } from 'zod'

const useTranslations = () => {
  const t = (key: string) => key
  return { t }
}

type MappingObject = z.infer<typeof mappingSchema>

type ColumnConfig = {
  [key: string]: {
    defaultMapping: string[];
    required: boolean;
  };
};

const columnConfig: ColumnConfig = {
  "instrument": { defaultMapping: ["symbol", "ticker"], required: true },
  "entryId": { defaultMapping: ["id", "tradeid", "orderid"], required: false },
  "quantity": { defaultMapping: ["qty", "amount", "volume"], required: true },
  "entryPrice": { defaultMapping: ["buyprice", "entryprice", "openprice"], required: true },
  "closePrice": { defaultMapping: ["sellprice", "exitprice", "closeprice"], required: true },
  "entryDate": { defaultMapping: ["buydate", "entrydate", "opentime"], required: true },
  "closeDate": { defaultMapping: ["selldate", "exitdate", "closetime"], required: true },
  "pnl": { defaultMapping: ["pnl", "profit"], required: true },
  "timeInPosition": { defaultMapping: ["timeinposition", "duration"], required: false },
  "side": { defaultMapping: ["side", "direction"], required: false },
  "commission": { defaultMapping: ["commission", "fee"], required: false },
  "stopLoss": { defaultMapping: ["stoploss", "sl", "stop"], required: false },
  "takeProfit": { defaultMapping: ["takeprofit", "tp", "target"], required: false },
  "closeReason": { defaultMapping: ["closereason", "reason", "exitreason"], required: false },
  "symbol": { defaultMapping: ["symbol", "ticker", "instrument"], required: false },
}

const destinationColumns = Object.keys(columnConfig)

interface ColumnMappingProps {
  headers: string[];
  csvData: string[][];
  mappings: { [key: string]: string };
  setMappings: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  error: string | null;
  importType: ImportType;
}

export default function ColumnMapping({ headers, csvData, mappings, setMappings, error, importType }: ColumnMappingProps) {
  const { object, submit, isLoading } = useObject({
    api: '/api/v1/ai/mappings',
    schema: mappingSchema,
    onError(error) {
    },
    onFinish({ object }) {
      
      setMappings(prev => {
        const newMappings = { ...prev };
        if (object) {
          Object.entries(object).forEach(([destinationColumn, header]) => {
            if (header && headers.includes(header) && !Object.values(prev).includes(destinationColumn)) {
              newMappings[header] = destinationColumn;
            }
          });
        }
        return newMappings;
      });

    }
  });

  const handleMapping = (header: string, value: string) => {
    setMappings(prev => {
      const newMappings = { ...prev }
      if (newMappings[header]) {
        delete newMappings[header]
      }
      Object.keys(newMappings).forEach(key => {
        if (newMappings[key] === value) {
          delete newMappings[key]
        }
      })
      newMappings[header] = value
      return newMappings
    })
  }

  const handleRemoveMapping = (header: string) => {
    setMappings(prev => {
      const newMappings = { ...prev }
      delete newMappings[header]
      return newMappings
    })
  }

  const getRemainingFieldsToMap = (): string[] => {
    return destinationColumns.filter(column =>
      !Object.values(mappings).includes(column)
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-none space-y-3">
        {getRemainingFieldsToMap().length > 0 && (
          <div className="bg-warning/10 border border-warning/25 p-4 rounded-xl relative overflow-hidden transition-all duration-300" role="alert">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3">
                <div className="relative mt-0.5">
                  <Sparkles className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Unmapped Fields Remaining</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Automate matching using AI or select mappings manually below.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => submit({ fieldColumns: headers, firstRows: csvData.slice(1, 6) })}
                className="flex items-center gap-2 bg-warning/10 hover:bg-warning/20 text-warning border-warning/20 transition-all duration-200"
              >
                {isLoading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Auto-Map with AI</span>
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-1.5 py-1">
          {getRemainingFieldsToMap().map((field, index) => (
            <Badge
              key={index}
              variant="outline"
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                columnConfig[field]?.required
                  ? "border-destructive/30 bg-destructive/5 text-destructive/90 hover:bg-destructive/10"
                  : "border-warning/30 bg-warning/5 text-warning/90 hover:bg-warning/10"
              )}
            >
              <span>
                {field === 'instrument' ? 'Instrument' :
                 field === 'entryId' ? 'Entry ID' :
                 field === 'quantity' ? 'Quantity' :
                 field === 'entryPrice' ? 'Entry Price' :
                 field === 'closePrice' ? 'Close Price' :
                 field === 'entryDate' ? 'Entry Date' :
                 field === 'closeDate' ? 'Close Date' :
                 field === 'pnl' ? 'PnL' :
                 field === 'timeInPosition' ? 'Time in Position' :
                 field === 'side' ? 'Side' :
                 field === 'commission' ? 'Commission' :
                 field === 'stopLoss' ? 'Stop Loss' :
                 field === 'takeProfit' ? 'Take Profit' :
                 field === 'closeReason' ? 'Close Reason' :
                 field === 'symbol' ? 'Symbol' :
                 field}
              </span>
              {columnConfig[field] && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help ml-1 opacity-70 hover:opacity-100">
                        {columnConfig[field]?.required ? (
                          <AlertTriangle className="h-3 w-3 text-destructive inline-block align-middle" />
                        ) : (
                          <Info className="h-3 w-3 text-warning inline-block align-middle" />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <p>{columnConfig[field]?.required ? "Required field" : "Optional field"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Badge>
          ))}
        </div>
      </div>
 
      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-xl bg-card">
        <Table>
          <TableHeader className="bg-muted/40 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b border-border/40">
              <TableHead className="font-semibold text-foreground/80 text-xs py-3">CSV Column</TableHead>
              <TableHead className="font-semibold text-foreground/80 text-xs py-3">Sample Values</TableHead>
              <TableHead className="font-semibold text-foreground/80 text-xs py-3 w-[240px]">Mapped Field</TableHead>
              <TableHead className="w-[50px] py-3"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header, index) => (
              <TableRow key={index} className="hover:bg-muted/20 border-b border-border/30 transition-colors">
                <TableCell className="font-medium text-sm text-foreground/90">{header}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  <div className="flex flex-wrap gap-1">
                    {csvData.slice(1, 4).map((row, i) => (
                      <span key={i} className="text-xs bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                        {row[index] || "-"}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Select
                    onValueChange={(value) => handleMapping(header, value)}
                    value={mappings[header] || (isLoading ? Object.entries(object || {}).find(([_, value]) => value === header)?.[0] : "") || ""}
                  >
                    <SelectTrigger className="w-[220px] bg-background border-border hover:bg-muted/50 transition-colors h-9">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationColumns.map((column, i) => (
                        <SelectItem key={i} value={column} disabled={Object.values(mappings).includes(column) && mappings[header] !== column}>
                          <span className="flex items-center gap-1.5">
                            {column === 'instrument' ? 'Instrument' :
                             column === 'entryId' ? 'Entry ID' :
                             column === 'quantity' ? 'Quantity' :
                             column === 'entryPrice' ? 'Entry Price' :
                             column === 'closePrice' ? 'Close Price' :
                             column === 'entryDate' ? 'Entry Date' :
                             column === 'closeDate' ? 'Close Date' :
                             column === 'pnl' ? 'PnL' :
                             column === 'timeInPosition' ? 'Time in Position' :
                             column === 'side' ? 'Side' :
                             column === 'commission' ? 'Commission' :
                             column === 'stopLoss' ? 'Stop Loss' :
                             column === 'takeProfit' ? 'Take Profit' :
                             column === 'closeReason' ? 'Close Reason' :
                             column === 'symbol' ? 'Symbol' :
                             column}
                            {columnConfig[column]?.required && (
                              <span className="text-destructive font-bold text-xs">*</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-2">
                  {mappings[header] && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove mapping for ${header}`}
                      title="Remove mapping"
                      onClick={() => handleRemoveMapping(header)}
                      className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground h-8 w-8 rounded-lg transition-all"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {error && <p className="text-destructive text-sm font-medium mt-1">{error}</p>}
    </div>
  )
}
