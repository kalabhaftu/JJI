'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading01Icon, Add01Icon, Delete02Icon, PencilEdit01Icon, Tick01Icon, Cancel01Icon, Tag01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { useTags } from '@/hooks/use-tags'

interface TagManagerProps {
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-profit))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-loss))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--ring))',
]

export function TagManager({ isOpen, onClose, onRefresh }: TagManagerProps) {
  const { tags, isLoading, createTag, updateTag, deleteTag } = useTags()
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0])
  const [isCreating, setIsCreating] = useState(false)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null)

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty')
      return
    }

    setIsCreating(true)
    try {
      await createTag(newTagName, selectedColor || '')
      setNewTagName('')
      setSelectedColor(DEFAULT_COLORS[0])
      toast.success('Tag created successfully')
      onRefresh?.()
    } catch (error: any) {
      reportClientError(error, { operation: 'create-tag', route: '/api/v1/tags' })
      toast.error(error.message || 'Failed to create tag')
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingTagId(tag.id)
    setEditingName(tag.name)
    setEditingColor(tag.color)
  }

  const handleSaveEdit = async () => {
    if (!editingTagId) return
    if (!editingName.trim()) {
      toast.error('Tag name cannot be empty')
      return
    }

    try {
      await updateTag(editingTagId, editingName, editingColor)
      setEditingTagId(null)
      toast.success('Tag updated successfully')
      onRefresh?.()
    } catch (error: any) {
      reportClientError(error, { operation: 'update-tag', route: '/api/v1/tags' })
      toast.error(error.message || 'Failed to update tag')
    }
  }

  const handleCancelEdit = () => {
    setEditingTagId(null)
    setEditingName('')
    setEditingColor('')
  }

  const handleDeleteTag = async (tagId: string) => {
    setDeleteTagTarget(tagId)
  }

  const handleDeleteTagConfirm = async () => {
    if (!deleteTagTarget) return
    try {
      await deleteTag(deleteTagTarget)
      toast.success('Tag deleted successfully')
      onRefresh?.()
    } catch (error) {
      reportClientError(error, { operation: 'delete-tag', route: '/api/v1/tags' })
      toast.error('Failed to delete tag')
    }
    setDeleteTagTarget(null)
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Tag01Icon} className="h-5 w-5 text-primary" strokeWidth={2} color="currentColor" />
            <DialogTitle>Manage Tags</DialogTitle>
          </div>
          <DialogDescription>
            Create and manage tags to categorize your trades
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <h3 className="text-sm font-semibold">Create New Tag</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag()
                }}
                className="flex-1"
              />
              <Button
                onClick={handleCreateTag}
                disabled={isCreating || !newTagName.trim()}
                size="sm"
              >
                {isCreating ? (
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                )}
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-md border-2 transition-all',
                      selectedColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:border-muted-foreground/50'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Your Tags ({tags.length})</h3>
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : tags.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    No tags yet. Create one above!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {editingTagId === tag.id ? (
                        <>
                          <div className="flex flex-wrap gap-1 mr-2">
                            {DEFAULT_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => setEditingColor(color)}
                                className={cn(
                                  'w-5 h-5 rounded border',
                                  editingColor === color
                                    ? 'border-foreground ring-1 ring-foreground'
                                    : 'border-transparent'
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            className="flex-1 h-8"
                          />
                          <Button
                            onClick={handleSaveEdit}
                            size="sm"
                            variant="tertiary"
                            className="h-8 px-2"
                            aria-label="Confirm edit"
                          >
                            <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4 text-profit" strokeWidth={2} color="currentColor" />
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="tertiary"
                            className="h-8 px-2"
                            aria-label="Cancel edit"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} color="currentColor" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge
                            style={{
                              backgroundColor: tag.color,
                              color: 'white',
                            }}
                            className="text-xs"
                          >
                            {tag.name}
                          </Badge>
                          <div className="flex-1" />
                          <Button
                            onClick={() => handleStartEdit(tag)}
                            size="sm"
                            variant="tertiary"
                            className="h-8 px-2"
                          >
                            <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} color="currentColor" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteTag(tag.id)}
                            size="sm"
                            variant="tertiary"
                            className="h-8 px-2"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 text-destructive" strokeWidth={2} color="currentColor" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {}
    <AlertDialog open={!!deleteTagTarget} onOpenChange={(open) => !open && setDeleteTagTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Delete this tag? It will be removed from all trades. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteTagConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
