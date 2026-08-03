export function parseNumericInput(value: string): number | undefined {
  const normalized = value.trim().replaceAll(',', '').replace(/[$%]/g, '')
  if (!normalized || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function focusFirstInvalidField(container: ParentNode = document) {
  const field = container.querySelector<HTMLElement>(
    '[aria-invalid="true"]:not([disabled]), [data-invalid="true"] input:not([disabled]), [data-invalid="true"] button:not([disabled]), [data-invalid="true"] textarea:not([disabled]), [data-invalid="true"] [tabindex]:not([tabindex="-1"])'
  )

  field?.focus()
  field?.scrollIntoView({ block: 'center' })
  return field ?? null
}
