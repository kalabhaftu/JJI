export const REQUEST_ID_HEADER = 'x-request-id'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

export function normalizeRequestId(value: string | null | undefined): string | null {
  if (!value) return null
  const candidate = value.trim()
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : null
}

export function createRequestId(): string {
  return crypto.randomUUID()
}

export function resolveRequestId(
  headers?: Pick<Headers, 'get'> | null,
): string {
  return normalizeRequestId(headers?.get(REQUEST_ID_HEADER)) ?? createRequestId()
}
