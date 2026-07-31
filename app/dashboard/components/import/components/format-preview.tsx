"use client";

import type { TradeType } from '@/lib/db/schema/trades';
;
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isValid } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { parsePositionTime } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React from "react";
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { Trade } from '@/types/trade-extended'
import { tradeSchema } from '@/app/api/v1/ai/format-trades/schema'
import { z } from 'zod'
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "@/context/data-provider";
import { calculateWinRate, classifyOutcome, getBreakEvenThreshold } from "@/lib/metrics/outcome";

interface FormatPreviewProps {
  trades: string[][];
  processedTrades: TradeType[];
  setProcessedTrades: (trades: TradeType[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  isLoading: boolean;
  headers: string[];
  mappings: { [key: string]: string };
}

function transformHeaders(headers: string[], mappings: { [key: string]: string }): string[] {
  return headers.map(header => {
    return mappings[header] ?? header;
  });
}

export function FormatPreview({
  trades: initialTrades,
  processedTrades,
  setProcessedTrades,
  setIsLoading,
  isLoading,
  headers,
  mappings,
}: FormatPreviewProps) {
  const { statistics } = useData();
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  // Transform headers using mappings
  const transformedHeaders = useMemo(() => transformHeaders(headers, mappings), [headers, mappings]);

  // Calculate valid trades only when initialTrades changes
  const validTrades = useMemo(() =>
    initialTrades.filter(row => row.length > 0 && row[0] !== ""),
    [initialTrades]
  );

  const [error, setError] = useState<string | null>(null);
  const [currentBatch, setCurrentBatch] = useState(0);

  // Optimized batch size - process more trades at once
  const batchSize = 25;
  const totalBatches = Math.ceil(validTrades.length / batchSize);

  const batchToProcess = useMemo(() => {
    const startIndex = currentBatch * batchSize;
    const endIndex = Math.min(startIndex + batchSize, validTrades.length);
    return validTrades.slice(startIndex, endIndex);
  }, [currentBatch, validTrades, batchSize]);

  const { object, submit, isLoading: isProcessing } = useObject({
    api: '/api/v1/ai/format-trades',
    schema: z.array(tradeSchema),
    onError(error) {
      setError(`Failed to process trades: ${error.message}`);
      setIsLoading(false);
    }
  });

  // Update parent loading state
  useEffect(() => {
    setIsLoading(isProcessing);
  }, [isProcessing, setIsLoading]);

  // Process trades when object updates
  useEffect(() => {
    if (object) {
      const newTrades = object.filter((trade): trade is NonNullable<typeof trade> => trade !== undefined) as any[];
      const uniqueTrades = newTrades.filter(newTrade =>
        !processedTrades.some(existingTrade =>
          existingTrade.entryDate === newTrade.entryDate &&
          existingTrade.instrument === newTrade.instrument &&
          existingTrade.quantity === newTrade.quantity
        )
      );
      if (uniqueTrades.length > 0) {
        setProcessedTrades([...processedTrades, ...uniqueTrades]);
      }
      // Auto-scroll after processing
      setTimeout(scrollToBottom, 100);
    }
  }, [object, processedTrades, setProcessedTrades]);

  // Auto-process next batch when current batch completes
  useEffect(() => {
    if (!isProcessing && hasStartedRef.current && currentBatch < totalBatches - 1 && processedTrades.length > 0) {
      const expectedProcessed = (currentBatch + 1) * batchSize;
      if (processedTrades.length >= Math.min(expectedProcessed, validTrades.length) * 0.8) {
        // Calculate next batch values BEFORE the timeout to avoid stale closure
        const nextBatch = currentBatch + 1;
        const nextBatchStart = nextBatch * batchSize;
        const nextBatchEnd = (nextBatch + 1) * batchSize;
        const nextBatchRows = validTrades.slice(nextBatchStart, nextBatchEnd);

        // Auto-advance to next batch
        const timer = setTimeout(() => {
          setCurrentBatch(nextBatch);
          submit({
            headers: transformedHeaders,
            rows: nextBatchRows
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isProcessing, currentBatch, totalBatches, processedTrades.length, validTrades.length, batchSize, submit, transformedHeaders, validTrades]);

  const handleStartProcessing = useCallback(() => {
    hasStartedRef.current = true;
    setCurrentBatch(0);
    submit({
      headers: transformedHeaders,
      rows: batchToProcess
    });
  }, [submit, transformedHeaders, batchToProcess]);

  const handleReset = useCallback(() => {
    hasStartedRef.current = false;
    setCurrentBatch(0);
    setProcessedTrades([]);
    setError(null);
  }, [setProcessedTrades]);

  const progressPercent = useMemo(() => {
    if (validTrades.length === 0) return 0;
    return Math.round((processedTrades.length / validTrades.length) * 100);
  }, [processedTrades.length, validTrades.length]);

  const columns = useMemo<ColumnDef<Partial<TradeType>>[]>(() => [
    {
      accessorKey: "entryDate",
      header: "Entry Date",
      cell: ({ row }) => {
        const entryDate = row.original.entryDate ? new Date(row.original.entryDate) : null;
        return entryDate && isValid(entryDate) ? format(entryDate, "yyyy-MM-dd HH:mm") : "-";
      },
      size: 150,
    },
    {
      accessorKey: "instrument",
      header: "Instrument",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.instrument || "-"}</span>
      ),
      size: 100,
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ row }) => (
        <Badge variant={row.original.side === 'long' ? 'default' : 'secondary'} className="capitalize">
          {row.original.side || "-"}
        </Badge>
      ),
      size: 80,
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => Number(row.original.quantity || 0).toFixed(2),
      size: 70,
    },
    {
      accessorKey: "entryPrice",
      header: "Entry",
      cell: ({ row }) => `$${row.original.entryPrice || '0'}`,
      size: 90,
    },
    {
      accessorKey: "closePrice",
      header: "Exit",
      cell: ({ row }) => `$${row.original.closePrice || '0'}`,
      size: 90,
    },
    {
      accessorKey: "pnl",
      header: "P&L",
      cell: ({ row }) => {
        const pnl = row.original.pnl ?? 0;
        return (
          <span className={pnl >= 0 ? "text-long font-medium" : "text-short font-medium"}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
        );
      },
      size: 90,
    },
    {
      accessorKey: "commission",
      header: "Comm",
      cell: ({ row }) => `$${(row.original.commission ?? 0).toFixed(2)}`,
      size: 70,
    },
    {
      accessorKey: "timeInPosition",
      header: "Duration",
      cell: ({ row }) => parsePositionTime(row.original.timeInPosition || 0),
      size: 90,
    },
  ], []);

  const table = useReactTable({
    data: processedTrades,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const scrollToBottom = () => {
    if (tableContainerRef.current) {
      const scrollContainer = tableContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="font-semibold text-lg">Processing Error</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <Button onClick={handleReset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Spinner className="h-4 w-4 text-primary" />
            ) : processedTrades.length === validTrades.length && validTrades.length > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-long" />
            ) : null}
            <span className="text-sm font-medium">
              {processedTrades.length} / {validTrades.length} trades
            </span>
          </div>
          {validTrades.length > 0 && (
            <div className="flex items-center gap-2 w-32">
              <Progress value={progressPercent} className="h-2" />
              <span className="text-xs text-muted-foreground">{progressPercent}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hasStartedRef.current || processedTrades.length === 0 ? (
            <Button
              onClick={handleStartProcessing}
              disabled={isProcessing || validTrades.length === 0}
              className="gap-2"
            >
              {isProcessing ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isProcessing ? "Processing..." : "Format Trades"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isProcessing}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden border rounded-lg">
        <div className="flex flex-col h-full">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap px-3 py-2 text-xs font-semibold"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
          </Table>
          <ScrollArea className="flex-1" ref={tableContainerRef}>
            <Table>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row, index) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.5) }}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="whitespace-nowrap px-3 py-2 text-sm"
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </motion.tr>
                    ))
                  ) : !isProcessing ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Play className="h-8 w-8" />
                          <p>Click "Format Trades" to begin processing</p>
                          <p className="text-xs">{validTrades.length} trades waiting</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </AnimatePresence>
                {isProcessing && (
                  <TableRow>
                    {columns.map((_, index) => (
                      <TableCell key={`loading-${index}`} className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      {/* Stats summary */}
      {processedTrades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-muted/50 border"
        >
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p className={cn(
              "text-lg font-bold",
              processedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) >= 0 ? "text-long" : "text-short"
            )}>
              ${processedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-lg font-bold">
              {(() => {
                const wins = processedTrades.filter(
                  t => classifyOutcome((t.pnl || 0), breakEvenThreshold) === 'win'
                ).length
                const losses = processedTrades.filter(
                  t => classifyOutcome((t.pnl || 0), breakEvenThreshold) === 'loss'
                ).length
                return calculateWinRate(wins, losses).toFixed(0)
              })()}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Trades</p>
            <p className="text-lg font-bold">{processedTrades.length}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
