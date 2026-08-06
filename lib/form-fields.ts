export type NumericParseOptions = {
  decimals?: number
  allowEmpty?: boolean
}

export function parseNumericInput(value: string, options?: NumericParseOptions): number | null | undefined {
  const normalized = value.trim().replaceAll(',', '').replace(/[$%\s]/g, '')
  if (!normalized) {
    return options?.allowEmpty ? null : undefined
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return undefined
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  if (options?.decimals !== undefined) {
    const factor = 10 ** options.decimals
    return Math.round(parsed * factor) / factor
  }

  return parsed
}

export function focusFirstInvalidField(container: ParentNode = document) {
  const field = container.querySelector<HTMLElement>(
    '[aria-invalid="true"]:not([disabled]), [data-invalid="true"] input:not([disabled]), [data-invalid="true"] button:not([disabled]), [data-invalid="true"] textarea:not([disabled]), [data-invalid="true"] [tabindex]:not([tabindex="-1"])'
  )

  field?.focus()
  field?.scrollIntoView({ block: 'center' })
  return field ?? null
}
