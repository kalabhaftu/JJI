import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface OptimizedAccountsLoadingProps {
  className?: string
  accountCount?: number
  showStats?: boolean
  showFilters?: boolean
}

function OptimizedAccountsLoading({ 
  className, 
  accountCount = 6, 
  showStats = true, 
  showFilters = true 
}: OptimizedAccountsLoadingProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <Skeleton className="h-10 w-64 mb-2 rounded-md" />
              <Skeleton className="h-5 w-80 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        </motion.div>
        
        {}
        {showStats && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20 rounded-md" />
                      <Skeleton className="h-7 w-16 rounded-md" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
        
        {}
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl shadow-sm border p-6 mb-8"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <Skeleton className="flex-1 h-10 rounded-md" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-40 rounded-md" />
                <Skeleton className="h-10 w-32 rounded-md" />
              </div>
            </div>
          </motion.div>
        )}
        
        {}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {Array.from({ length: accountCount }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (i * 0.05) }}
              className="h-full"
            >
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-5 w-32 rounded-md" />
                      </div>
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20 rounded-md" />
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-12 rounded-md" />
                      <Skeleton className="h-5 w-8 rounded-md" />
                    </div>
                  </div>
                  <div className="min-h-[120px] space-y-3">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-6 w-full rounded-md" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

interface OptimizedAccountSelectionLoadingProps {
  className?: string
  accountCount?: number
}

export function OptimizedAccountSelectionLoading({ 
  className, 
  accountCount = 3 
}: OptimizedAccountSelectionLoadingProps) {
  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-48 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="w-1.5 h-1.5 rounded-full" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto mt-4 py-2 min-h-[200px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: accountCount }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
