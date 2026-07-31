'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Plus, TrendingUp as TrendUp, TrendingDown as TrendDown } from "lucide-react"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuickAddStore } from '@/store/quick-add-store'
import { useUserStore } from '@/store/user-store'

interface QuickAddFABProps {
    className?: string
}

export function QuickAddFAB({ className }: QuickAddFABProps) {
    const isOpen = useQuickAddStore((state) => state.isOpen)
    const openQuickAdd = useQuickAddStore((state) => state.openQuickAdd)
    const closeQuickAdd = useQuickAddStore((state) => state.closeQuickAdd)
    const setQuickAddOpen = useQuickAddStore((state) => state.setQuickAddOpen)
    const user = useUserStore((state) => state.user)
    const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        instrument: '',
        side: 'long' as 'long' | 'short',
        pnl: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.instrument || !formData.pnl) {
            toast.error('Please fill in all fields')
            return
        }

        setIsSubmitting(true)

        try {
            if (isDemo) {
                toast.success('Trade added (Demo mode: changes are temporary)')
                setFormData({ instrument: '', side: 'long', pnl: '' })
                closeQuickAdd()
                setIsSubmitting(false)
                return
            }

            const response = await fetch('/api/v1/trades/quick-add', {
              method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instrument: formData.instrument.toUpperCase(),
                    side: formData.side,
                    pnl: parseFloat(formData.pnl),
                    entryDate: new Date().toISOString()
                })
            })

            if (response.ok) {
                toast.success('Trade added successfully')
                setFormData({ instrument: '', side: 'long', pnl: '' })
                closeQuickAdd()
                window.location.reload()
            } else {
                throw new Error('Failed to add trade')
            }
        } catch (error) {
            toast.error('Failed to add trade')
        } finally {
            setIsSubmitting(false)
        }
    }

    const pnlValue = parseFloat(formData.pnl) || 0

    return (
        <Dialog open={isOpen} onOpenChange={setQuickAddOpen}>
            <Button
                type="button"
                size="icon"
                onClick={openQuickAdd}
                data-tour="quick-add-btn"
                className={cn(
                    "fixed bottom-28 right-6 h-14 w-14 rounded-full shadow-md z-[60]",
                    "bg-primary hover:bg-primary/90 text-primary-foreground",
                    "lg:hidden", // Match bottom nav breakpoint
                    className
                )}
                aria-label="Quick add trade"
            >
                <Plus className="h-6 w-6" />
            </Button>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Quick Add Trade</DialogTitle>
                    <DialogDescription>
                        Add a trade with just the essentials
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="instrument">Instrument</Label>
                        <Input
                            id="instrument"
                            placeholder="e.g., ES, NQ, EURUSD"
                            value={formData.instrument}
                            onChange={(e) => setFormData(prev => ({ ...prev, instrument: e.target.value }))}
                            className="uppercase"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={formData.side === 'long' ? 'default' : 'outline'}
                                className={cn(
                                    "flex-1 gap-2",
                                    formData.side === 'long' && "bg-long hover:bg-long/80"
                                )}
                                onClick={() => setFormData(prev => ({ ...prev, side: 'long' }))}
                            >
                                <TrendUp className="h-4 w-4" />
                                Long
                            </Button>
                            <Button
                                type="button"
                                variant={formData.side === 'short' ? 'default' : 'outline'}
                                className={cn(
                                    "flex-1 gap-2",
                                    formData.side === 'short' && "bg-short hover:bg-short/80"
                                )}
                                onClick={() => setFormData(prev => ({ ...prev, side: 'short' }))}
                            >
                                <TrendDown className="h-4 w-4" />
                                Short
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pnl">P&L ($)</Label>
                        <Input
                            id="pnl"
                            type="number"
                            step="0.01"
                            placeholder="e.g., 150 or -50"
                            value={formData.pnl}
                            onChange={(e) => setFormData(prev => ({ ...prev, pnl: e.target.value }))}
                            className={cn(
                                pnlValue > 0 && "text-long border-long/50",
                                pnlValue < 0 && "text-short border-short/50"
                            )}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Adding...' : 'Add Trade'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
