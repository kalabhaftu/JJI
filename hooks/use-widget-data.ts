'use client'

import { useData } from '@/context/data-provider'


export function useWidgetData(type: string) {
  const { widgetData, error } = useData()

  return {
    data: widgetData?.[type] ?? [],
    isLoading: widgetData === null && !error,
    error: error ?? null
  }
}
