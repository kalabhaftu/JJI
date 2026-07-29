export interface WidgetLayout {
  i: string
  type: string
  size: string
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardTemplate {
  id: string
  userId: string
  name: string
  isDefault: boolean | null
  isActive: boolean | null
  layout: WidgetLayout[]
  createdAt: Date | null
  updatedAt: Date
}
