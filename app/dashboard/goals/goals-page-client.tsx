"use client"

import { useState, useCallback, type ComponentType } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { apiRequest } from '@/lib/api/client'
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Target01Icon,
  Add01Icon,
  Delete02Icon,
  CircleCheckIcon,
  TrendingUpDownIcon,
  Award01Icon,
  Dollar01Icon,
  FlameIcon,
  BarChartIcon,
  StarIcon,
  PencilEdit01Icon,
} from '@hugeicons/core-free-icons'
import { GoalsPageSkeleton } from "./components/goals-page-skeleton"
import { isDemoSurface } from "@/lib/public-surface-routing"

type GoalMetric = "pnl" | "winRate" | "trades" | "streak" | "drawdown" | "custom"
type GoalPeriod = "daily" | "weekly" | "monthly" | "all-time"

interface Goal {
  id: string
  title: string
  description?: string
  metric: GoalMetric
  targetValue: number
  currentValue: number
  period: GoalPeriod
  startDate: string
  endDate?: string
  isCompleted: boolean
  completedAt?: string
  createdAt: string
}

const METRIC_LABELS: Record<GoalMetric, string> = {
  pnl: "Net P&L ($)",
  winRate: "Win Rate (%)",
  trades: "Trade Count",
  streak: "Win Streak",
  drawdown: "Max Drawdown (%)",
  custom: "Custom",
}

const METRIC_ICONS: Record<GoalMetric, import('@hugeicons/react').HugeiconsIconProps['icon']> = {
  pnl: Dollar01Icon,
  winRate: Target01Icon,
  trades: BarChartIcon,
  streak: FlameIcon,
  drawdown: TrendingUpDownIcon,
  custom: StarIcon,
}

async function fetchGoals(): Promise<{ goals: Goal[] }> {
  const response = await apiRequest<Goal[]>('/api/v1/goals')
  return { goals: response.data ?? [] }
}

async function createGoal(data: Partial<Goal>): Promise<{ goal: Goal }> {
  const response = await apiRequest<Goal>('/api/v1/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!response.data) throw new Error('Failed to create goal')
  return { goal: response.data }
}

async function updateGoal(id: string, data: Partial<Goal>): Promise<{ goal: Goal }> {
  const response = await apiRequest<Goal>(`/api/v1/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!response.data) throw new Error('Failed to update goal')
  return { goal: response.data }
}

async function deleteGoal(id: string): Promise<void> {
  await apiRequest(`/api/v1/goals/${id}`, { method: 'DELETE' })
}

function GoalCard({ goal, onDelete, onEdit }: { goal: Goal; onDelete: (id: string) => void; onEdit?: (goal: Goal) => void }) {
  const progressPct = Math.min((goal.currentValue / goal.targetValue) * 100, 100)
  const metricIcon = METRIC_ICONS[goal.metric as GoalMetric]

  return (
    <div className={cn(
      "rounded-[24px] border bg-card/50 p-5 space-y-4 transition-all",
      goal.isCompleted
        ? "border-long/30 bg-long/5"
        : "border-border/20 hover:border-border/40"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={metricIcon} className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">{goal.title}</p>
            {goal.description && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {goal.isCompleted && <HugeiconsIcon icon={CircleCheckIcon} className="h-4 w-4 text-long" strokeWidth={1.5} color="currentColor" />}
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-border/20">
            {goal.period}
          </Badge>
          {onEdit && (
            <Button
              variant="tertiary"
              size="icon"
              aria-label={`Edit goal ${goal.title}`}
              title="Edit goal"
               className="h-11 w-11 text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onEdit(goal) }}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
            </Button>
          )}
          <Button
            variant="tertiary"
            size="icon"
            aria-label={`Delete goal ${goal.title}`}
            title="Delete goal"
             className="h-11 w-11 text-muted-foreground hover:text-short"
            onClick={(e) => { e.stopPropagation(); onDelete(goal.id) }}
          >
            <HugeiconsIcon icon={Delete02Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-bold">{METRIC_LABELS[goal.metric as GoalMetric]}</span>
          <span className={cn("font-black font-mono", goal.isCompleted ? "text-long" : "text-foreground")}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
          </span>
        </div>
        <Progress
          value={progressPct}
          className="h-1.5"
        />
        <p className="text-[9px] text-muted-foreground/40 font-bold">
          {progressPct.toFixed(0)}% complete
          {goal.endDate && ` · Ends ${new Date(goal.endDate).toLocaleDateString()}`}
        </p>
      </div>
    </div>
  )
}

function EmptyGoals() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/30 bg-card/20 py-24 gap-4">
      <HugeiconsIcon icon={Award01Icon} className="h-12 w-12 text-muted-foreground/20" strokeWidth={1.5} color="currentColor" />
      <div className="text-center">
        <p className="text-sm font-bold text-muted-foreground/50 uppercase tracking-widest">No goals yet</p>
        <p className="text-xs text-muted-foreground/30 mt-1">Create your first trading goal to get started</p>
      </div>
    </div>
  )
}

import { useUserStore } from "@/store/user-store"
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'

export function GoalsPageClient() {
  const qc = useQueryClient()
  const user = useUserStore(state => state.user)
  const scope = useQueryScope()
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    metric: 'pnl' as GoalMetric,
    targetValue: '',
    period: 'monthly' as GoalPeriod,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.goals(scope),
    queryFn: async () => {
      if (isDemo) {
        return {
          goals: [
            {
              id: 'mock-goal-1',
              title: 'Achieve 60% win rate this month',
              description: 'Maintain strict risk management and execution guidelines',
              metric: 'winRate' as const,
              targetValue: 60,
              currentValue: 55,
              period: 'monthly' as const,
              startDate: new Date().toISOString(),
              isCompleted: false,
              createdAt: new Date().toISOString()
            },
            {
              id: 'mock-goal-2',
              title: 'Net P&L target of $5,000',
              description: 'Focus on scaling high probability setups',
              metric: 'pnl' as const,
              targetValue: 5000,
              currentValue: 5432,
              period: 'monthly' as const,
              startDate: new Date().toISOString(),
              isCompleted: true,
              completedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            },
            {
              id: 'mock-goal-3',
              title: 'Log at least 40 trades',
              description: 'Build sufficient sample size for the new order block model',
              metric: 'trades' as const,
              targetValue: 40,
              currentValue: 80,
              period: 'monthly' as const,
              startDate: new Date().toISOString(),
              isCompleted: true,
              completedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            },
            {
              id: 'mock-goal-4',
              title: 'Maintain 5-win streak',
              description: 'Executing clean confluences',
              metric: 'streak' as const,
              targetValue: 5,
              currentValue: 4,
              period: 'weekly' as const,
              startDate: new Date().toISOString(),
              isCompleted: false,
              createdAt: new Date().toISOString()
            }
          ]
        }
      }
      return fetchGoals()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (goalData: Partial<Goal>) => {
      if (isDemo) {
        const newGoal: Goal = {
          id: `mock-goal-${Date.now()}`,
          title: goalData.title || '',
          description: goalData.description || '',
          metric: goalData.metric || 'pnl',
          targetValue: goalData.targetValue || 0,
          currentValue: 0,
          period: goalData.period || 'monthly',
          startDate: goalData.startDate || new Date().toISOString(),
          isCompleted: false,
          createdAt: new Date().toISOString()
        }
        return { goal: newGoal }
      }
      return createGoal(goalData)
    },
    onSuccess: (resData) => {
      if (isDemo) {
        qc.setQueryData<{ goals: Goal[] }>(queryKeys.goals(scope), (old) => ({
          goals: [...(old?.goals || []), resData.goal]
        }))
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.goals(scope) })
      }
      setIsCreateOpen(false)
      setForm({
        title: '',
        description: '',
        metric: 'pnl',
        targetValue: '',
        period: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      })
      toast.success('Goal created')
    },
    onError: () => toast.error('Failed to create goal'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return
      return deleteGoal(id)
    },
    onSuccess: (_, deletedId) => {
      if (isDemo) {
        qc.setQueryData<{ goals: Goal[] }>(queryKeys.goals(scope), (old) => ({
          goals: (old?.goals || []).filter(g => g.id !== deletedId)
        }))
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.goals(scope) })
      }
      toast.success('Goal deleted')
    },
    onError: () => toast.error('Failed to delete goal'),
  })

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    metric: 'pnl' as GoalMetric,
    targetValue: '',
    currentValue: '',
    period: 'monthly' as GoalPeriod,
    endDate: '',
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Goal> }) => {
      if (isDemo) {
        qc.setQueryData<{ goals: Goal[] }>(queryKeys.goals(scope), (old) => ({
          goals: (old?.goals || []).map(g => g.id === id ? { ...g, ...data } : g)
        }))
        return { goal: { ...data, id } as Goal }
      }
      return updateGoal(id, data)
    },
    onSuccess: () => {
      if (!isDemo) qc.invalidateQueries({ queryKey: queryKeys.goals(scope) })
      setEditingGoal(null)
      toast.success('Goal updated')
    },
    onError: () => toast.error('Failed to update goal'),
  })

  const handleEditStart = useCallback((goal: Goal) => {
    setEditingGoal(goal)
    setEditForm({
      title: goal.title,
      description: goal.description || '',
      metric: goal.metric,
      targetValue: String(goal.targetValue),
      currentValue: String(goal.currentValue),
      period: goal.period,
      endDate: goal.endDate || '',
    })
  }, [])

  const handleEditSave = useCallback(() => {
    if (!editingGoal || !editForm.title || !editForm.targetValue) {
      toast.error('Title and target value are required')
      return
    }
    updateMutation.mutate({
      id: editingGoal.id,
      data: {
        title: editForm.title,
        ...(editForm.description && { description: editForm.description }),
        metric: editForm.metric,
        targetValue: parseFloat(editForm.targetValue),
        currentValue: parseFloat(editForm.currentValue) || 0,
        period: editForm.period,
        ...(editForm.endDate && { endDate: editForm.endDate }),
      },
    })
  }, [editingGoal, editForm, updateMutation])

  const goals = data?.goals || []
  const active = goals.filter(g => !g.isCompleted)
  const completed = goals.filter(g => g.isCompleted)

  const handleCreate = useCallback(() => {
    if (!form.title || !form.targetValue) {
      toast.error('Title and target value are required')
      return
    }

    const { startDate, endDate, targetValue, ...rest } = form

    createMutation.mutate({
      ...rest,
      targetValue: parseFloat(targetValue),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    })
  }, [form, createMutation])

  if (isLoading) {
    return <GoalsPageSkeleton />
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Goals"
        meta="Track progress towards your trading objectives"
        actions={
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
            <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
            New Goal
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyGoals />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <HugeiconsIcon icon={TrendingUpDownIcon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
                Active ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map(g => (
                  <GoalCard key={g.id} goal={g} onDelete={id => deleteMutation.mutate(id)} onEdit={handleEditStart} />
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <HugeiconsIcon icon={CircleCheckIcon} className="h-3.5 w-3.5 text-long" strokeWidth={1.5} color="currentColor" />
                Completed ({completed.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map(g => (
                  <GoalCard key={g.id} goal={g} onDelete={id => deleteMutation.mutate(id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <HugeiconsIcon icon={Target01Icon} className="h-4 w-4 text-primary" strokeWidth={1.5} color="currentColor" />
              Create New Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Achieve 60% win rate this month"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional context..."
                className="min-h-[60px] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Metric</Label>
                <Select value={form.metric} onValueChange={v => setForm(f => ({ ...f, metric: v as GoalMetric }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_LABELS).map(([k, v]) => {
                      const itemIcon = METRIC_ICONS[k as GoalMetric]
                      return (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={itemIcon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
                            {v}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Period</Label>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v as GoalPeriod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="all-time">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Target Value</Label>
              <Input
                type="number"
                step="any"
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="e.g. 60"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">End Date (optional)</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {                      }
      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4 text-primary" strokeWidth={1.5} color="currentColor" />
              Edit Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Achieve 60% win rate this month"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
              <Textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional context..."
                className="min-h-[60px] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Metric</Label>
                <Select value={editForm.metric} onValueChange={v => setEditForm(f => ({ ...f, metric: v as GoalMetric }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_LABELS).map(([k, v]) => {
                      const itemIcon = METRIC_ICONS[k as GoalMetric]
                      return (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={itemIcon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
                            {v}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Period</Label>
                <Select value={editForm.period} onValueChange={v => setEditForm(f => ({ ...f, period: v as GoalPeriod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="all-time">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Target Value</Label>
                <Input
                  type="number"
                  step="any"
                  value={editForm.targetValue}
                  onChange={e => setEditForm(f => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Current Value</Label>
                <Input
                  type="number"
                  step="any"
                  value={editForm.currentValue}
                  onChange={e => setEditForm(f => ({ ...f, currentValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">End Date (optional)</Label>
              <Input
                type="date"
                value={editForm.endDate}
                onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setEditingGoal(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
