export type QuerySurface = 'authenticated' | 'demo'

export interface QueryScope {
  surface: QuerySurface
  userId?: string
}
