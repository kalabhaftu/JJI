import { TagSelector } from '@/app/dashboard/components/tags/tag-selector'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MARKET_BIAS_OPTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { MarketBias, TradeOutcome } from '@/types/trade-extended'

interface Rule {
    text: string
    category: 'entry' | 'exit' | 'risk' | 'general'
}

interface TradingModel {
    id: string
    name: string
    rules: (string | Rule)[]
    notes?: string | null
}

interface TradeStrategyTabProps {
    marketBias: MarketBias | null
    setMarketBias: (bias: MarketBias | null) => void
    orderType: string | null
    setOrderType: (type: string | null) => void
    selectedModelId: string | null
    setModelId: (id: string | null) => void
    tradingModels: TradingModel[]
    selectedModel: TradingModel | null
    setSelectedModel: (model: TradingModel | null) => void
    selectedRules: string[]
    setSelectedRules: (rules: string[]) => void
    selectedTags: string[]
    setSelectedTags: (tags: string[]) => void
    tradeOutcome: TradeOutcome | null
    setTradeOutcome: (outcome: TradeOutcome | null) => void
    ruleBroken: boolean
    setRuleBroken: (broken: boolean) => void
}

export function TradeStrategyTab({
    marketBias,
    setMarketBias,
    orderType,
    setOrderType,
    selectedModelId,
    setModelId,
    tradingModels,
    selectedModel,
    setSelectedModel,
    selectedRules,
    setSelectedRules,
    selectedTags,
    setSelectedTags,
    tradeOutcome,
    setTradeOutcome,
    ruleBroken,
    setRuleBroken
}: TradeStrategyTabProps) {
    const compliance = selectedModel && selectedModel.rules.length > 0
        ? (selectedRules.length / selectedModel.rules.length) * 100
        : 0

    return (
        <div className="space-y-8 px-1">
            {}
            <div className="space-y-4">
                <div className="space-y-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Contextual Bias</h3>
                    <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">Overall market sentiment for this execution</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {MARKET_BIAS_OPTIONS.map(({ value, label, activeClass }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setMarketBias(value as MarketBias)}
                            className={cn(
                                "py-3 px-4 border rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                                marketBias === value
                                    ? activeClass
                                    : 'bg-muted/10 hover:bg-muted/20 border-border/40 text-muted-foreground'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {}
            <div className="space-y-4 pt-2">
                <div className="space-y-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Trade Outcome</h3>
                    <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">Categorize the quality of this trade</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    {[
                        { value: 'GOOD_WIN', label: 'A Good Win', colorClass: 'bg-long/10 hover:bg-long/20 border-long/20 text-long' },
                        { value: 'BAD_WIN', label: 'A Bad Win', colorClass: 'bg-warning/10 hover:bg-warning/20 border-warning/20 text-warning' },
                        { value: 'GOOD_BE', label: 'A Good BE', colorClass: 'bg-muted/10 hover:bg-muted/20 border-border/40 text-foreground' },
                        { value: 'BAD_BE', label: 'A Bad BE', colorClass: 'bg-warning/10 hover:bg-warning/20 border-warning/20 text-warning' },
                        { value: 'GOOD_LOSS', label: 'A Good Loss', colorClass: 'bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary' },
                        { value: 'BAD_LOSS', label: 'A Bad Loss', colorClass: 'bg-short/10 hover:bg-short/20 border-short/20 text-short' },
                    ].map(({ value, label, colorClass }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setTradeOutcome(value as TradeOutcome)

                                if (value.includes('BAD_')) {
                                    setRuleBroken(true)
                                }
                            }}
                            className={cn(
                                "py-2 px-1 border rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all text-center leading-tight",
                                tradeOutcome === value
                                    ? colorClass.replace('hover:', '').replace('/10', '/30').replace('/20', '/40')
                                    : 'bg-muted/5 hover:bg-muted/10 border-border/20 text-muted-foreground/30'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                {}
                <div className="space-y-3">
                    <Label htmlFor="order-type" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Execution Logic</Label>
                    <Select
                        value={orderType || '__none__'}
                        onValueChange={(value) => setOrderType(value === '__none__' ? null : value)}
                    >
                        <SelectTrigger id="order-type" className="w-full h-11 rounded-xl border-border/40 bg-muted/10 text-xs font-bold uppercase tracking-tighter">
                            <SelectValue placeholder="UNCATEGORIZED" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">UNCATEGORIZED</SelectItem>
                            <SelectItem value="market">MARKET ORDER</SelectItem>
                            <SelectItem value="limit">LIMIT ORDER</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {}
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Trading System (Model)</Label>
                    <Select
                        value={selectedModelId || '__none__'}
                        onValueChange={(value) => {
                            const modelId = value === '__none__' ? null : value
                            setModelId(modelId)
                            const model = tradingModels.find(m => m.id === modelId)
                            setSelectedModel(model || null)
                            if (modelId !== selectedModelId) {
                                setSelectedRules([])
                            }
                        }}
                    >
                        <SelectTrigger className="w-full h-11 rounded-xl border-border/40 bg-muted/10 text-xs font-bold uppercase tracking-tighter">
                            <SelectValue placeholder="NO ACTIVE MODEL" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">NO ACTIVE MODEL</SelectItem>
                            {tradingModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.name.toUpperCase()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedModel && selectedModel.rules.length > 0 && (
                <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Verification Protocol</Label>
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                            compliance === 100 ? "bg-long/10 text-long" : compliance > 50 ? "bg-warning/10 text-warning" : "bg-short/10 text-short"
                        )}>
                            Compliance: {compliance.toFixed(0)}%
                        </span>
                    </div>

                    <div className="flex items-center space-x-2 pb-2">
                        <input
                            type="checkbox"
                            id="rule-broken"
                            checked={ruleBroken}
                            onChange={(e) => setRuleBroken(e.target.checked)}
                            className="h-4 w-4 rounded-md border-border/40 bg-muted/20 text-destructive focus:ring-destructive/20 transition-all cursor-pointer"
                        />
                        <Label htmlFor="rule-broken" className="text-xs font-bold text-destructive/90 cursor-pointer uppercase tracking-tight">
                            Rule Broken / Revenge Trade
                        </Label>
                    </div>

                    <div className="space-y-6 border border-border/40 rounded-2xl p-6 bg-muted/5">
                        {(['entry', 'exit', 'risk', 'general'] as const).map(cat => {
                            const catRules = selectedModel.rules.filter(r =>
                                (typeof r === 'string' && cat === 'general') || (typeof r === 'object' && r.category === cat)
                            )
                            if (catRules.length === 0) return null

                            return (
                                <div key={cat} className="space-y-3">
                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">{cat} criteria</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {catRules.map((rule, idx) => {
                                            const ruleText = typeof rule === 'string' ? rule : rule.text
                                            return (
                                                <label key={idx} className="flex items-center gap-3 cursor-pointer group py-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRules.includes(ruleText)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedRules([...selectedRules, ruleText])
                                                            } else {
                                                                setSelectedRules(selectedRules.filter(r => r !== ruleText))
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded-md border-border/40 bg-muted/20 text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-muted-foreground/80 group-hover:text-foreground transition-colors uppercase tracking-tight">{ruleText}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trade Tags</Label>
                </div>
                <div className="p-1">
                    <TagSelector
                        selectedTagIds={selectedTags}
                        onChange={setSelectedTags}
                    />
                </div>
            </div>
        </div>
    )
}
