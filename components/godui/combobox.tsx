"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ComboboxOption = { value: string; label: string }

export function Combobox({ options, value, onValueChange, placeholder = "Select…", searchPlaceholder = "Search…", className }: { options: ComboboxOption[]; value: string; onValueChange: (value: string) => void; placeholder?: string; searchPlaceholder?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())), [options, query])
  const selected = options.find((option) => option.value === value)

  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery("") }}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" className={cn("h-10 min-w-0 justify-between px-0 text-[11px] font-bold uppercase tracking-wider hover:bg-transparent", className)} aria-expanded={open}><span className="truncate">{selected?.label ?? placeholder}</span><ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-2">
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="h-8 pl-8 text-xs" /></div>
      <div role="listbox" aria-label={placeholder} className="mt-2 max-h-64 overflow-y-auto">
        <button type="button" role="option" aria-selected={value === "all"} onClick={() => { onValueChange("all"); setOpen(false) }} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted/60"><span>{placeholder}</span>{value === "all" && <Check className="size-3.5 text-primary" />}</button>
        {filtered.map((option) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} onClick={() => { onValueChange(option.value); setOpen(false) }} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted/60"><span className="truncate">{option.label}</span>{value === option.value && <Check className="size-3.5 text-primary" />}</button>)}
        {filtered.length === 0 && <p className="px-2.5 py-3 text-xs text-muted-foreground">No matches.</p>}
      </div>
    </PopoverContent>
  </Popover>
}
