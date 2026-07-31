'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  getUserTemplates,
  getActiveTemplate,
  createTemplate as createTemplateAction,
  deleteTemplate as deleteTemplateAction,
  switchTemplate as switchTemplateAction,
  updateTemplateLayout as updateTemplateLayoutAction,
  type DashboardTemplate,
  type WidgetLayout
} from '@/server/dashboard-templates'
import { ensureDefaultTemplate } from '@/server/seed-default-template'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { toast } from 'sonner'
import { useData } from '@/context/data-provider'

interface TemplateContextType {
  templates: DashboardTemplate[]
  activeTemplate: DashboardTemplate | null
  isLoading: boolean
  createTemplate: (name: string) => Promise<DashboardTemplate>
  deleteTemplate: (templateId: string) => Promise<void>
  switchTemplate: (templateId: string) => Promise<DashboardTemplate>
  updateLayout: (templateId: string, layout: WidgetLayout[]) => Promise<DashboardTemplate>
  reload: () => Promise<void>
}

const TemplateContext = createContext<TemplateContextType | null>(null)

interface TemplateProviderProps {
  children: React.ReactNode
  initialActiveTemplate?: DashboardTemplate | null
}

type TemplateBootstrapCache = {
  templates: DashboardTemplate[]
  activeTemplate: DashboardTemplate | null
} | null

let templateBootstrapCache: TemplateBootstrapCache = null
let templateBootstrapInFlight: Promise<TemplateBootstrapCache> | null = null

const buildFallbackTemplate = (): DashboardTemplate => ({
  id: 'fallback',
  userId: 'temp',
  name: 'Default',
  isDefault: true,
  isActive: true,
  layout: cloneDefaultTemplateLayout() as WidgetLayout[],
  createdAt: new Date(),
  updatedAt: new Date(),
})

export function TemplateProvider({ children, initialActiveTemplate = null }: TemplateProviderProps) {
  const data = useData()
  const isDemoMode = !!data?.isDemoMode

  const [templates, setTemplates] = useState<DashboardTemplate[]>(
    initialActiveTemplate ? [initialActiveTemplate] : []
  )
  const [activeTemplate, setActiveTemplate] = useState<DashboardTemplate | null>(
    initialActiveTemplate ?? buildFallbackTemplate()
  )
  const [isLoading, setIsLoading] = useState(!initialActiveTemplate)
  const hasLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)

  const loadTemplates = useCallback(async () => {
    if (isDemoMode) {
      const fallback = buildFallbackTemplate()
      setTemplates([fallback])
      setActiveTemplate(fallback)
      setIsLoading(false)
      return
    }

    if (hasLoadedRef.current || isLoadingRef.current) {
      return
    }

    isLoadingRef.current = true
    hasLoadedRef.current = true

    try {
      if (templateBootstrapCache) {
        setTemplates(templateBootstrapCache.templates)
        setActiveTemplate(templateBootstrapCache.activeTemplate)
        setIsLoading(false)
        return
      }

      if (templateBootstrapInFlight) {
        const cachedResult = await templateBootstrapInFlight
        if (cachedResult) {
          setTemplates(cachedResult.templates)
          setActiveTemplate(cachedResult.activeTemplate)
          setIsLoading(false)
          return
        }
      }

      templateBootstrapInFlight = (async () => {
        const allTemplates = await getUserTemplates()
        const active = await getActiveTemplate()

        if (allTemplates.length > 0 && active) {
          return {
            templates: allTemplates,
            activeTemplate: active,
          }
        }

        // No templates yet - create default for new users
        await ensureDefaultTemplate()

        const newTemplates = await getUserTemplates()
        const newActive = await getActiveTemplate()

        if (newTemplates.length > 0 && newActive) {
          return {
            templates: newTemplates,
            activeTemplate: newActive,
          }
        }

        return {
          templates: [],
          activeTemplate: buildFallbackTemplate(),
        }
      })()

      const result = await templateBootstrapInFlight
      templateBootstrapCache = result

      if (result) {
        setTemplates(result.templates)
        setActiveTemplate(result.activeTemplate)
      } else {
        setActiveTemplate(buildFallbackTemplate())
      }
    } catch (error) {
      setTimeout(() => toast.error('Failed to load templates'), 0)

      setActiveTemplate(buildFallbackTemplate())

      hasLoadedRef.current = false // Allow retry on error
      templateBootstrapCache = null
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
      templateBootstrapInFlight = null
    }
  }, [isDemoMode])

  // Load on mount - only once
  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!mounted) return
      await loadTemplates()
    }

    load()

    return () => {
      mounted = false
    }
  }, [loadTemplates])

  // Create new template
  const handleCreateTemplate = useCallback(async (name: string) => {
    if (isDemoMode) {
      const newTemplate: DashboardTemplate = {
        id: `demo-template-${Date.now()}`,
        userId: 'demo-user',
        name,
        isDefault: false,
        isActive: false,
        layout: cloneDefaultTemplateLayout() as WidgetLayout[],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      setTemplates(prev => [...prev, newTemplate])
      setTimeout(() => toast.success(`Template "${name}" created successfully`), 0)
      return newTemplate
    }
    try {
      const newTemplate = await createTemplateAction(name)
      setTemplates(prev => [...prev, newTemplate])
      templateBootstrapCache = null
      setTimeout(() => toast.success(`Template "${name}" created successfully`), 0)
      return newTemplate
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create template'
      setTimeout(() => toast.error(message), 0)
      throw error
    }
  }, [isDemoMode])

  // Delete template
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (isDemoMode) {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      if (activeTemplate?.id === templateId) {
        setActiveTemplate(buildFallbackTemplate())
      }
      setTimeout(() => toast.success('Template deleted successfully'), 0)
      return
    }
    try {
      await deleteTemplateAction(templateId)
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      templateBootstrapCache = null

      // If deleted template was active, reload to get new active template
      if (activeTemplate?.id === templateId) {
        hasLoadedRef.current = false
        await loadTemplates()
      }

      setTimeout(() => toast.success('Template deleted successfully'), 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete template'
      setTimeout(() => toast.error(message), 0)
      throw error
    }
  }, [isDemoMode, activeTemplate, loadTemplates])

  // Switch template
  const handleSwitchTemplate = useCallback(async (templateId: string) => {
    if (isDemoMode) {
      const target = templates.find(t => t.id === templateId) || buildFallbackTemplate()
      const updated = { ...target, isActive: true }
      setActiveTemplate(updated)
      setTemplates(prev => prev.map(t => ({
        ...t,
        isActive: t.id === templateId,
      })))
      return updated
    }
    try {
      const updated = await switchTemplateAction(templateId)
      setActiveTemplate(updated)
      setTemplates(prev => prev.map(t => ({
        ...t,
        isActive: t.id === templateId,
      })))
      templateBootstrapCache = null
      // Toast removed - template-selector shows "Template updated" text instead
      // setTimeout(() => toast.success('Template switched successfully'), 0)
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch template'
      setTimeout(() => toast.error(message), 0)
      throw error
    }
  }, [isDemoMode, templates])

  // Update template layout
  const handleUpdateLayout = useCallback(async (templateId: string, layout: WidgetLayout[]) => {
    if (isDemoMode) {
      const updated = {
        ...(templates.find(t => t.id === templateId) || buildFallbackTemplate()),
        layout
      }
      setTemplates(prev => prev.map(t => t.id === templateId ? updated : t))
      if (activeTemplate?.id === templateId) {
        setActiveTemplate(updated)
      }
      return updated
    }
    try {
      const updated = await updateTemplateLayoutAction(templateId, layout)
      setTemplates(prev => prev.map(t => t.id === templateId ? updated : t))
      if (activeTemplate?.id === templateId) {
        setActiveTemplate(updated)
      }
      templateBootstrapCache = null
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update layout'
      setTimeout(() => toast.error(message), 0)
      throw error
    }
  }, [isDemoMode, templates, activeTemplate])

  const value: TemplateContextType = {
    templates,
    activeTemplate,
    isLoading,
    createTemplate: handleCreateTemplate,
    deleteTemplate: handleDeleteTemplate,
    switchTemplate: handleSwitchTemplate,
    updateLayout: handleUpdateLayout,
    reload: loadTemplates,
  }

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>
}

export function useTemplates() {
  const context = useContext(TemplateContext)
  if (!context) {
    throw new Error('useTemplates must be used within a TemplateProvider')
  }
  return context
}


