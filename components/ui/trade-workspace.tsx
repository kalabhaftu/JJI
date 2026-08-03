'use client'

import { createContext, useCallback, useContext, useState, type ReactElement, type ReactNode } from 'react'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const TradeWorkspaceCloseContext = createContext<(() => void) | null>(null)

export function useTradeWorkspaceClose(): () => void {
  const requestClose = useContext(TradeWorkspaceCloseContext)
  if (!requestClose) throw new Error('useTradeWorkspaceClose must be used inside TradeWorkspace')
  return requestClose
}

export function TradeWorkspaceCloseButton({ children, ...props }: React.ComponentProps<typeof Button>): ReactElement {
  const requestClose = useTradeWorkspaceClose()
  return <Button type="button" onClick={requestClose} {...props}>{children}</Button>
}

export interface TradeWorkspaceProps {
  open?: boolean
  mode: 'route' | 'dialog' | 'sheet'
  title: string
  description?: string
  dirty?: boolean
  onRequestClose(): void
  onConfirmDiscard?: () => void
  children: ReactNode
  footer?: ReactNode
  returnTo?: string
}

export function TradeWorkspace({ open = true, mode, title, description, dirty = false, onRequestClose, onConfirmDiscard, children, footer, returnTo }: TradeWorkspaceProps): ReactElement {
  const [discardOpen, setDiscardOpen] = useState(false)
  const requestClose = useCallback(() => {
    if (dirty) setDiscardOpen(true)
    else onRequestClose()
  }, [dirty, onRequestClose])
  const handleDismissEvent = useCallback((event: { preventDefault(): void }) => {
    if (!dirty) return
    event.preventDefault()
    requestClose()
  }, [dirty, requestClose])
  const confirmDiscard = () => {
    setDiscardOpen(false)
    onConfirmDiscard?.()
    onRequestClose()
  }
  const body = <div className="flex min-h-0 flex-1 flex-col">{children}{footer}</div>
  const heading = <><DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>{body}</>
  const sheetHeading = <><SheetHeader className="sr-only"><SheetTitle>{title}</SheetTitle>{description && <SheetDescription>{description}</SheetDescription>}</SheetHeader>{body}</>
  return <TradeWorkspaceCloseContext.Provider value={requestClose}>
    {mode === 'route' ? <section role="region" aria-label={title} className={cn('flex h-full min-h-0 flex-col', !open && 'hidden')} data-return-to={returnTo}><h1 className="sr-only">{title}</h1>{description && <p className="sr-only">{description}</p>}{body}</section> : mode === 'dialog' ? <Dialog open={open} onOpenChange={(value) => !value && requestClose()}><DialogContent onEscapeKeyDown={handleDismissEvent} onPointerDownOutside={handleDismissEvent} onInteractOutside={handleDismissEvent} className="flex h-[calc(100dvh-1rem)] max-w-6xl flex-col p-0 sm:h-[calc(100dvh-3rem)] sm:max-w-6xl">{heading}</DialogContent></Dialog> : <Sheet open={open} onOpenChange={(value) => !value && requestClose()}><SheetContent hasAccessibleSemantics onEscapeKeyDown={handleDismissEvent} onPointerDownOutside={handleDismissEvent} onInteractOutside={handleDismissEvent} className="flex flex-col sm:w-[40rem] sm:max-w-[min(40rem,100vw)]">{sheetHeading}</SheetContent></Sheet>}
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your changes will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={confirmDiscard}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </TradeWorkspaceCloseContext.Provider>
}
