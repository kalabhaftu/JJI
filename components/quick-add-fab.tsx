'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, ChartDownIcon, ChartUpIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { useQuickAddStore } from '@/store/quick-add-store'
import { buildTradeEntryHref } from '@/app/dashboard/trades/new/trade-entry-draft'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function QuickAddFAB({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openQuickAdd = useQuickAddStore((state) => state.openQuickAdd)
  const isOpen = useQuickAddStore((state) => state.isOpen)
  const setQuickAddOpen = useQuickAddStore((state) => state.setQuickAddOpen)
  const [instrument, setInstrument] = useState('')
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [pnl, setPnl] = useState('')
  const open = () => {
    if (typeof window !== 'undefined' && isDemoSurface(window.location.hostname, pathname)) return openQuickAdd()
    const query = searchParams.toString()
    router.push(buildTradeEntryHref({ origin: 'quick-add', returnTo: `${pathname}${query ? `?${query}` : ''}` }))
  }
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, pathname)
  return <Dialog open={isDemo && isOpen} onOpenChange={setQuickAddOpen}>
    <Button type="button" size="icon" onClick={open} data-tour="quick-add-btn" className={cn('fixed bottom-28 right-6 z-[60] h-14 w-14 rounded-full shadow-md lg:hidden', className)} aria-label="Add trade"><HugeiconsIcon icon={Add01Icon} strokeWidth={2} color="currentColor" /></Button>
    <DialogContent><DialogHeader><DialogTitle>Quick Add Trade</DialogTitle><DialogDescription>Add a temporary trade to the demo.</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (!instrument.trim() || !pnl.trim()) return; toast.success('Trade added (Demo mode: changes are temporary)'); setInstrument(''); setPnl(''); setSide('long'); setQuickAddOpen(false) }}>
        <div className="flex flex-col gap-2"><Label htmlFor="demo-instrument">Instrument</Label><Input id="demo-instrument" value={instrument} onChange={(event) => setInstrument(event.target.value)} /></div>
        <div className="flex gap-2">
          <Button type="button" variant={side === 'long' ? "primary" : "secondary"} className="flex-1" onClick={() => setSide('long')}><HugeiconsIcon icon={ChartUpIcon} className="mr-2 h-4 w-4" strokeWidth={2} color="currentColor" />Long</Button>
          <Button type="button" variant={side === 'short' ? "primary" : "secondary"} className="flex-1" onClick={() => setSide('short')}><HugeiconsIcon icon={ChartDownIcon} className="mr-2 h-4 w-4" strokeWidth={2} color="currentColor" />Short</Button>
        </div>
        <div className="flex flex-col gap-2"><Label htmlFor="demo-pnl">P&amp;L ($)</Label><Input id="demo-pnl" type="number" step="0.01" value={pnl} onChange={(event) => setPnl(event.target.value)} /></div>
        <Button type="submit">Add Trade</Button>
      </form>
    </DialogContent>
  </Dialog>
}
