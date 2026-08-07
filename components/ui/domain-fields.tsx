"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { parseNumericInput } from "@/lib/form-fields"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FieldOption = {
  value: string
  label: string
  disabled?: boolean
}

type ControlledSelectProps = {
  value?: string
  onValueChange: (value: string) => void
  options: FieldOption[]
  placeholder?: string
} & Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "value" | "onChange">

export function ControlledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  ...triggerProps
}: ControlledSelectProps) {
  return (
    <Select value={value ?? ""} onValueChange={onValueChange} {...(triggerProps.disabled === undefined ? {} : { disabled: triggerProps.disabled })}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} {...(option.disabled === undefined ? {} : { disabled: option.disabled })} data-value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

type NumericFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value?: number | undefined
  onValueChange: (value: number | undefined) => void
}

function NumericField({ value, onValueChange, className, ...props }: NumericFieldProps) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "")

  React.useEffect(() => setDraft(value?.toString() ?? ""), [value])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={draft}
      className={className}
      onChange={(event) => {
        setDraft(event.target.value)
        onValueChange(parseNumericInput(event.target.value) ?? undefined)
      }}
    />
  )
}

export function CurrencyField(props: NumericFieldProps) {
  return <NumericField {...props} />
}

export function PercentageField(props: NumericFieldProps) {
  return <NumericField {...props} />
}

type DateTimeTimezoneFieldProps = {
  dateTime: string
  timezone: string
  onDateTimeChange: (value: string) => void
  onTimezoneChange: (value: string) => void
  timezones: FieldOption[]
  dateTimeLabel?: string
  timezoneLabel?: string
  disabled?: boolean
  invalid?: boolean
}

export function DateTimeTimezoneField({
  dateTime,
  timezone,
  onDateTimeChange,
  onTimezoneChange,
  timezones,
  dateTimeLabel = "Date and time",
  timezoneLabel = "Timezone",
  disabled,
  invalid,
}: DateTimeTimezoneFieldProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)]">
      <Input
        type="datetime-local"
        aria-label={dateTimeLabel}
        aria-invalid={invalid || undefined}
        value={dateTime}
        disabled={disabled}
        onChange={(event) => onDateTimeChange(event.target.value)}
      />
      <ControlledSelect
        aria-label={timezoneLabel}
        aria-invalid={invalid || undefined}
        value={timezone}
        onValueChange={onTimezoneChange}
        options={timezones}
        disabled={disabled}
        placeholder="Select timezone"
      />
    </div>
  )
}

type OptionPickerProps = {
  value?: string
  onValueChange: (value: string) => void
  options: FieldOption[]
  placeholder?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange">

export function SymbolCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Select symbol",
  className,
  ...buttonProps
}: OptionPickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search symbols" />
          <CommandList>
            <CommandEmpty>No symbols found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`}
                  {...(option.disabled === undefined ? {} : { disabled: option.disabled })}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("opacity-0", option.value === value && "opacity-100")} aria-hidden />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type TagMultiSelectProps = {
  value: string[]
  onValueChange: (value: string[]) => void
  options: FieldOption[]
  placeholder?: string
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">

export function TagMultiSelect({
  value,
  onValueChange,
  options,
  placeholder = "Add tags",
  className,
  ...props
}: TagMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.filter((option) => value.includes(option.value))

  function toggle(nextValue: string) {
    onValueChange(value.includes(nextValue) ? value.filter((item) => item !== nextValue) : [...value, nextValue])
  }

  return (
    <div {...props} role="group" className={cn("flex flex-col gap-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {selected.map((option) => (
            <Badge key={option.value} className="gap-1">
              {option.label}
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => toggle(option.value)}
              >
                <X aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-between font-normal">
            {placeholder}
            <ChevronsUpDown aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags" />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option.value} value={`${option.value} ${option.label}`} {...(option.disabled === undefined ? {} : { disabled: option.disabled })} onSelect={() => toggle(option.value)}>
                    <Check className={cn("opacity-0", value.includes(option.value) && "opacity-100")} aria-hidden />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type EditableTableFieldProps = {
  value: string
  onValueChange: (value: string) => void
  commitOnBlur?: boolean
  onCommit?: (value: string) => void
  onCancel?: () => void
  invalid?: boolean
  disabled?: boolean
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onKeyDown" | "onBlur">

export function EditableTableField({
  value,
  onValueChange,
  commitOnBlur = true,
  onCommit,
  onCancel,
  invalid,
  disabled,
  className,
  ...props
}: EditableTableFieldProps) {
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => setDraft(value), [value])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      onValueChange(draft)
      onCommit?.(draft)
    } else if (event.key === "Escape") {
      event.preventDefault()
      setDraft(value)
      onCancel?.()
    }
  }

  function handleBlur() {
    if (draft === value) return
    if (commitOnBlur) {
      onValueChange(draft)
      onCommit?.(draft)
    } else {
      setDraft(value)
      onCancel?.()
    }
  }

  return (
    <Input
      {...props}
      type="text"
      value={draft}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn("h-8 w-full px-2", className)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  )
}
