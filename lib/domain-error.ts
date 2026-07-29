export class DomainError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.status = status
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
