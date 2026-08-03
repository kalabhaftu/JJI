
import React from 'react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'


export interface NewsEvent {
    id: string
    name: string
    country: string
    category: string
    description?: string
}

interface TradeNewsTabProps {
    isNewsDay: boolean
    setIsNewsDay: (value: boolean) => void
    newsSearchQuery: string
    setNewsSearchQuery: (value: string) => void
    filteredNewsEvents: NewsEvent[]
    selectedNewsEvents: string[]
    setSelectedNewsEvents: (events: string[]) => void
    newsTraded: boolean
    setNewsTraded: (value: boolean) => void
}

export function TradeNewsTab({
    isNewsDay,
    setIsNewsDay,
    newsSearchQuery,
    setNewsSearchQuery,
    filteredNewsEvents,
    selectedNewsEvents,
    setSelectedNewsEvents,
    newsTraded,
    setNewsTraded
}: TradeNewsTabProps) {
    return (
        <div className="space-y-6 px-1">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Economic Events</h3>
                        <p className="text-xs text-muted-foreground">Select relevant economic events that influenced the trade.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
                        <Label htmlFor="news-day" className="text-xs font-medium cursor-pointer">News Day</Label>
                        <input
                            id="news-day"
                            type="checkbox"
                            checked={isNewsDay}
                            onChange={(e) => {
                                setIsNewsDay(e.target.checked)
                                if (!e.target.checked) {
                                    setSelectedNewsEvents([])
                                    setNewsTraded(false)
                                }
                            }}
                            className="h-3.5 w-3.5 rounded border-input"
                        />
                    </div>
                </div>

                {isNewsDay && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search news events..."
                                value={newsSearchQuery}
                                onChange={(e) => setNewsSearchQuery(e.target.value)}
                                className="pl-9 bg-muted/20 border-border/50 focus:bg-background transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {}
                            {(() => {
                                const highImpactUsdIds = ['us-nfp', 'us-cpi', 'us-core-cpi', 'us-fomc-rate', 'us-fomc-statement', 'us-fed-chair']
                                const highImpactEvents = filteredNewsEvents.filter(e => highImpactUsdIds.includes(e.id))
                                
                                if (highImpactEvents.length === 0) return null
                                
                                return (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-destructive uppercase tracking-widest pl-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                            High-Impact USD Events
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {highImpactEvents.map(event => (
                                                <label
                                                    key={event.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${selectedNewsEvents.includes(event.id)
                                                        ? 'bg-destructive/5 border-destructive/30 ring-1 ring-destructive/10'
                                                        : 'bg-background hover:bg-muted/50 border-destructive/20 hover:border-destructive/40'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedNewsEvents.includes(event.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedNewsEvents([...selectedNewsEvents, event.id])
                                                            } else {
                                                                setSelectedNewsEvents(selectedNewsEvents.filter(id => id !== event.id))
                                                            }
                                                        }}
                                                        className="h-4 w-4 mt-0.5 rounded border-destructive text-destructive focus:ring-destructive/20"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold transition-colors ${selectedNewsEvents.includes(event.id) ? 'text-destructive' : 'text-foreground'}`}>
                                                                {event.name}
                                                            </span>
                                                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 font-bold">
                                                                {event.country}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
                                                            {event.description}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}

                            {['employment', 'inflation', 'interest-rate', 'gdp', 'pmi', 'retail', 'housing', 'trade', 'manufacturing', 'bank-holiday', 'other'].map(category => {
                                const highImpactUsdIds = ['us-nfp', 'us-cpi', 'us-core-cpi', 'us-fomc-rate', 'us-fomc-statement', 'us-fed-chair']
                                const events = filteredNewsEvents.filter(e => e.category === category && !highImpactUsdIds.includes(e.id))
                                if (events.length === 0) return null

                                return (
                                    <div key={category} className="space-y-3">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                                            {category.replace('-', ' ')}
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {events.map(event => (
                                                <label
                                                    key={event.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${selectedNewsEvents.includes(event.id)
                                                        ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/10'
                                                        : 'bg-background hover:bg-muted/50 border-transparent hover:border-border'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedNewsEvents.includes(event.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedNewsEvents([...selectedNewsEvents, event.id])
                                                            } else {
                                                                setSelectedNewsEvents(selectedNewsEvents.filter(id => id !== event.id))
                                                            }
                                                        }}
                                                        className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary/20"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-medium transition-colors ${selectedNewsEvents.includes(event.id) ? 'text-primary' : 'text-foreground'}`}>
                                                                {event.name}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-muted/60 text-muted-foreground font-normal">
                                                                {event.country}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 group-hover:line-clamp-none transition-all">
                                                            {event.description}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {selectedNewsEvents.length > 0 && (
                            <div className="flex items-center gap-3 p-4 border rounded-xl bg-primary/5 border-primary/20">
                                <input
                                    id="news-traded"
                                    type="checkbox"
                                    checked={newsTraded}
                                    onChange={(e) => setNewsTraded(e.target.checked)}
                                    className="h-4 w-4 rounded border-primary/30 text-primary"
                                />
                                <Label htmlFor="news-traded" className="cursor-pointer">
                                    <span className="text-sm font-semibold text-primary">Execution during news</span>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        I actively managed or executed positions during this high-impact release.
                                    </p>
                                </Label>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
