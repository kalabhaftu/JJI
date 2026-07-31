import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

export interface TradeRowProps {
    trade: any
    evaluationType?: string
}

function getPhaseDisplayName(evaluationType: string | undefined, phaseNumber: number | undefined): string {
    if (!phaseNumber) return 'Phase 1'
    if (isFundedPhase(evaluationType, phaseNumber)) return 'Funded'
    return `Phase ${phaseNumber}`
}

function isFundedPhase(evaluationType: string | undefined, phaseNumber: number | undefined): boolean {
    return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber || 0)
}

function formatCurrency(amount: number | undefined | null) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0)
}

export function TradeRow({ trade, evaluationType }: TradeRowProps) {
    const pnl = trade.pnl || 0
    return (
        <tr className="border-b hover:bg-muted/50 transition-colors">
            <td className="p-3 font-medium">{trade.instrument || trade.symbol || 'N/A'}</td>
            <td className="p-3">
                <Badge variant={trade.side?.toUpperCase() === 'BUY' ? 'default' : 'secondary'}>
                    {trade.side?.toUpperCase() || 'N/A'}
                </Badge>
            </td>
            <td className="p-3 text-sm">{trade.quantity || 'N/A'}</td>
            <td className={cn("p-3 font-medium", pnl >= 0 ? "text-long" : "text-short")}>
                {formatCurrency(pnl)}
            </td>
            <td className="p-3">
                <Badge variant="outline" className="text-xs">
                    {trade.phase ? getPhaseDisplayName(evaluationType, trade.phase.phaseNumber) : 'Phase 1'}
                </Badge>
            </td>
            <td className="p-3 text-sm text-muted-foreground">
                {trade.exitTime ? new Date(trade.exitTime).toLocaleDateString() :
                    trade.entryDate ? new Date(trade.entryDate).toLocaleDateString() : 'N/A'}
            </td>
        </tr>
    )
}
