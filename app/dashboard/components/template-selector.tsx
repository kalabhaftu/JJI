'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTemplates } from '@/context/template-provider'
import { useTemplateEditStore } from '@/store/template-edit-store'
import { Button } from '@/components/ui/button'
import { RevealAction } from '@/components/ui/reveal-action'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LayoutGrid, Check, Plus, Pencil, Trash2, Copy, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'

export function TemplateSelector() {
  const { templates, activeTemplate, switchTemplate, createTemplate, deleteTemplate, updateLayout } = useTemplates()
  const { isEditMode, enterEditMode } = useTemplateEditStore()
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameDialogMode, setNameDialogMode] = useState<'create' | 'clone'>('create')
  const [templateName, setTemplateName] = useState('')


  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleSwitch = async (templateId: string) => {
    if (templateId === activeTemplate?.id) return
    try {
      await switchTemplate(templateId)
    } catch (e) {
      reportClientError(e, { operation: 'switch-dashboard-template', route: '/dashboard' })
    }
  }

  const getUniqueName = (baseName: string): string => {
    const existingNames = new Set(templates.map(t => t.name.toLowerCase()))
    if (!existingNames.has(baseName.toLowerCase())) return baseName
    let counter = 1
    while (existingNames.has(`${baseName}${counter}`.toLowerCase())) counter++
    return `${baseName}${counter}`
  }

  const isNameTaken = useCallback((name: string): boolean => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return false
    return templates.some((template) => template.name.trim().toLowerCase() === normalized)
  }, [templates])

  const nameTaken = isNameTaken(templateName)

  const suggestedNames = useMemo(() => {
    if (!nameTaken) return []

    const base = templateName.trim() || (nameDialogMode === 'clone' ? `${activeTemplate?.name || 'Template'} Copy` : 'Template')
    const suggestions: string[] = []
    const seen = new Set<string>()

    const tryAdd = (candidate: string) => {
      const normalized = candidate.trim().toLowerCase()
      if (!normalized || seen.has(normalized) || isNameTaken(candidate)) return
      seen.add(normalized)
      suggestions.push(candidate)
    }


    tryAdd(`${base}-1`)
    tryAdd(`${base} copy`)
    tryAdd(`${base} v2`)


    let index = 1
    while (suggestions.length < 3 && index <= 50) {
      tryAdd(`${base}-${index}`)
      tryAdd(`${base} ${index}`)
      tryAdd(`${base} copy ${index}`)
      tryAdd(`${base} v${index + 1}`)
      index += 1
    }

    return suggestions.slice(0, 3)
  }, [nameTaken, templateName, nameDialogMode, activeTemplate, isNameTaken])

  const openNameDialog = (mode: 'create' | 'clone') => {
    setNameDialogMode(mode)
    if (mode === 'clone' && activeTemplate) {
      setTemplateName(getUniqueName(`${activeTemplate.name} Copy`))
    } else {
      setTemplateName(getUniqueName('New Template'))
    }
    setNameDialogOpen(true)
  }

  const openCloneDialog = () => {
    if (!activeTemplate) return
    openNameDialog('clone')
  }

  const openCreateDialog = () => {
    openNameDialog('create')
  }

  const handleNameDialogConfirm = async () => {
    const finalName = templateName.trim()
    if (!finalName) return

    if (isNameTaken(finalName)) {
      toast.error(`A template named "${finalName}" already exists.`)
      return
    }

    if (nameDialogMode === 'clone' && !activeTemplate) return

    try {
      const cloned = await createTemplate(finalName)
      if (nameDialogMode === 'clone' && activeTemplate) {
        await updateLayout(cloned.id, activeTemplate.layout)
      }
      await switchTemplate(cloned.id)
      if (nameDialogMode === 'clone') {
        toast.success(`Template "${finalName}" created - you can now edit it`)
      }
    } catch (e) {
      reportClientError(e, { operation: 'create-dashboard-template', route: '/dashboard' })
      const message = e instanceof Error ? e.message : 'Failed to save template'
      toast.error(message)
    }
    setNameDialogOpen(false)
    setTemplateName('')
  }

  const handleDeleteClick = (templateId: string, name: string) => {
    setDeleteTarget({ id: templateId, name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteTemplate(deleteTarget.id)
    } catch (e) {
      reportClientError(e, { operation: 'delete-dashboard-template', route: '/dashboard' })
    }
    setDeleteTarget(null)
  }

  const handleEdit = () => {
    if (!activeTemplate) return
    if (activeTemplate.isDefault) {
      toast.info('Default template is read-only. Clone it to edit.')
      openCloneDialog()
      return
    }
    enterEditMode(activeTemplate.layout)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="nav"
            size="navIcon"
            title={activeTemplate?.name || 'Templates'}
            aria-label={activeTemplate?.name ? `Template: ${activeTemplate.name}` : 'Templates'}
          >
            <LayoutGrid aria-hidden />
            <span className="sr-only">{activeTemplate?.name || 'Templates'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {}
          {templates.map(t => (
            <DropdownMenuItem
              key={t.id}
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => handleSwitch(t.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {t.isActive ? (
                  <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                ) : (
                  <div className="w-3.5" />
                )}
                <span className="truncate">{t.name}</span>
                {t.isDefault && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
              {!t.isDefault && (
                <RevealAction
                  size="icon"
                  aria-label={`Delete template ${t.name}`}
                  className="h-10 w-10 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClick(t.id, t.name)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </RevealAction>
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {}
          {!isEditMode && activeTemplate && !activeTemplate.isDefault && (
            <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit Layout
            </DropdownMenuItem>
          )}

          {}
          {activeTemplate?.isDefault && (
            <DropdownMenuItem onClick={openCloneDialog} className="cursor-pointer">
              <Copy className="h-3.5 w-3.5 mr-2" />
              Clone & Edit
            </DropdownMenuItem>
          )}

          {}
          <DropdownMenuItem onClick={openCreateDialog} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-2" />
            New Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{nameDialogMode === 'clone' ? 'Clone Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {nameDialogMode === 'clone'
                ? 'Enter a name for the cloned template.'
                : 'Enter a name for your new template.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Template name"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNameDialogConfirm()
            }}
          />
          {nameTaken && (
            <div className="space-y-2">
              <p className="text-xs text-destructive">
                This name is already taken. Try one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedNames.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTemplateName(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNameDialogConfirm} disabled={!templateName.trim() || nameTaken}>
              {nameDialogMode === 'clone' ? 'Clone' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
