"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Clock, Trophy, TrendingUp, Calendar, Target, Zap, Medal, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhaseHistoryData {
  id: string
  phaseNumber: number
  phaseId: string | null
  status: 'active' | 'archived' | 'passed' | 'failed' | 'pending'
  startDate: string
  endDate: string | null
  totalTrades: number
  totalPnL: number
  winRate: number
  profitTargetPercent: number
  profitProgress: number
  bestTrade?: {
    symbol: string
    pnl: number
    date: string
  }
  worstTrade?: {
    symbol: string
    pnl: number
    date: string
  }
}

interface HistoryTabProps {
  accountName: string
  propFirmName: string
  accountSize: number
  phases: PhaseHistoryData[]
  breaches?: any[]
  evaluationType?: string
}

export function HistoryTab({ accountName, propFirmName, accountSize, phases, breaches = [], evaluationType = 'Two Step' }: HistoryTabProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const isFundedPhase = (phaseNumber: number): boolean => {
    switch (evaluationType) {
      case 'Two Step':
        return phaseNumber >= 3
      case 'One Step':
        return phaseNumber >= 2
      case 'Instant':
        return phaseNumber >= 1
      default:
        return phaseNumber >= 3 // Default to Two Step behavior
    }
  }

  const getPhaseIcon = (status: string, phaseNumber: number) => {
    if (isFundedPhase(phaseNumber) && status === 'active') return <Trophy className="h-5 w-5 text-primary" />
    
    switch (status) {
      case 'active': return <Clock className="h-5 w-5 text-primary" />
      case 'archived':
      case 'passed': return <CheckCircle2 className="h-5 w-5 text-long" />
      case 'failed': return <XCircle className="h-5 w-5 text-destructive" />
      default: return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getPhaseName = (phaseNumber: number) => {
    if (isFundedPhase(phaseNumber)) return 'Funded Account'
    return `Phase ${phaseNumber}`
  }

  const completedPhases = phases.filter(p => p.status === 'archived' || p.status === 'passed')
  const activePhase = phases.find(p => p.status === 'active')
  const failedPhases = phases.filter(p => p.status === 'failed')

  const totalTrades = phases.reduce((sum, p) => sum + p.totalTrades, 0)
  const totalPnL = phases.reduce((sum, p) => sum + p.totalPnL, 0)
  const avgWinRate = phases.filter(p => p.totalTrades > 0).length > 0
    ? phases.filter(p => p.totalTrades > 0).reduce((sum, p) => sum + p.winRate, 0) / phases.filter(p => p.totalTrades > 0).length
    : 0
  
  // Find longest winning streak (simplified - phases with positive P&L)
  const profitablePhases = phases.filter(p => p.totalPnL > 0).length
  
  const bestPhase = phases.reduce((best, phase) => 
    phase.totalPnL > (best?.totalPnL ?? -Infinity) ? phase : best
  , phases[0])

  const worstDrawdown = Math.min(...phases.map(p => p.totalPnL), 0)
  const phasesInDrawdown = phases.filter(p => p.totalPnL < 0).length

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Account Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Account Name</p>
              <p className="text-lg font-semibold">{accountName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Prop Firm</p>
              <p className="text-lg font-semibold">{propFirmName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Account Size</p>
              <p className="text-lg font-semibold">{formatCurrency(accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Phases</p>
              <p className="text-lg font-semibold">{phases.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-1">{completedPhases.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Phase{completedPhases.length !== 1 ? 's' : ''} passed</p>
              </div>
              <div className="p-3 bg-long/10 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-long" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Phase</p>
                <p className="text-3xl font-bold mt-1">{activePhase ? getPhaseName(activePhase.phaseNumber) : 'None'}</p>
                {activePhase && (
                  <p className="text-xs text-muted-foreground mt-1">{activePhase.totalTrades} trades</p>
                )}
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold mt-1">{failedPhases.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Attempt{failedPhases.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Performance & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Overall Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Total Trades</span>
              <span className="text-base font-semibold">{totalTrades}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Total P&L</span>
              <span className={cn("text-base font-semibold", totalPnL >= 0 ? "text-long" : "text-short")}>
                {formatCurrency(totalPnL)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Average Win Rate</span>
              <span className="text-base font-semibold">{avgWinRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Profitable Phases</span>
              <span className="text-base font-semibold">{profitablePhases} of {phases.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Milestones & Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Medal className="h-4 w-4" />
              Milestones & Records
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Best Phase */}
            {bestPhase && bestPhase.totalPnL > 0 && (
              <div className="flex items-start gap-3 p-3 bg-long/5 border border-long/20 rounded-lg">
                <div className="p-1.5 bg-long/10 rounded">
                  <Trophy className="h-4 w-4 text-long" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Best Phase Performance</p>
                  <p className="text-xs text-muted-foreground">
                    {getPhaseName(bestPhase.phaseNumber)} • {formatCurrency(bestPhase.totalPnL)} profit
                  </p>
                </div>
              </div>
            )}

            {/* Worst Drawdown */}
            {worstDrawdown < 0 && (
              <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="p-1.5 bg-destructive/10 rounded">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Highest Drawdown</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(Math.abs(worstDrawdown))} loss • {phasesInDrawdown} phase{phasesInDrawdown !== 1 ? 's' : ''} in drawdown
                  </p>
                </div>
              </div>
            )}

            {/* Current Streak */}
            {completedPhases.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="p-1.5 bg-primary/10 rounded">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Achievement</p>
                  <p className="text-xs text-muted-foreground">
                    Completed {completedPhases.length} phase{completedPhases.length !== 1 ? 's' : ''} successfully
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Phase Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4">
            {/* Timeline Line */}
            <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-border" />

            {phases.map((phase, index) => {
              const phaseDuration = phase.endDate 
                ? Math.floor((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / (1000 * 60 * 60 * 24))
                : Math.floor((Date.now() - new Date(phase.startDate).getTime()) / (1000 * 60 * 60 * 24))
              
              return (
                <div key={phase.id} className="relative flex gap-4">
                  {/* Timeline Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full border-2 bg-background",
                      phase.status === 'active' && "border-primary",
                      (phase.status === 'archived' || phase.status === 'passed') && "border-long",
                      phase.status === 'failed' && "border-destructive",
                      phase.status === 'pending' && "border-muted"
                    )}>
                      {getPhaseIcon(phase.status, phase.phaseNumber)}
                    </div>
                  </div>

                  {/* Phase Card */}
                  <Card className={cn(
                    "flex-1 transition-colors",
                    phase.status === 'active' && "border-primary/30 bg-primary/5",
                    phase.status === 'failed' && "border-destructive/30 bg-destructive/5"
                  )}>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base">
                              {getPhaseName(phase.phaseNumber)}
                            </h3>
                            {isFundedPhase(phase.phaseNumber) && (
                              <Badge variant="outline" className="bg-primary/10 border-primary/30">
                                <Trophy className="h-3 w-3 mr-1" />
                                Funded
                              </Badge>
                            )}
                          </div>
                          {phase.phaseId && (
                            <p className="text-xs text-muted-foreground">Account: {phase.phaseId}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{formatDate(phase.startDate)}</span>
                            {phase.endDate && (
                              <>
                                <span>→</span>
                                <span>{formatDate(phase.endDate)}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{phaseDuration} day{phaseDuration !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            phase.status === 'active' ? 'default' :
                            (phase.status === 'archived' || phase.status === 'passed') ? 'secondary' :
                            phase.status === 'failed' ? 'destructive' : 'outline'
                          }
                        >
                          {phase.status === 'archived' ? 'Passed' : phase.status.charAt(0).toUpperCase() + phase.status.slice(1)}
                        </Badge>
                      </div>

                      {/* Stats */}
                      {phase.status !== 'pending' && (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Trades</p>
                              <p className="text-lg font-semibold">{phase.totalTrades}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
                              <p className={cn(
                                "text-lg font-semibold",
                                phase.totalPnL >= 0 ? "text-long" : "text-short"
                              )}>
                                {formatCurrency(phase.totalPnL)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                              <p className="text-lg font-semibold">{phase.winRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Target</p>
                              <div className="flex items-center gap-1">
                                <p className="text-lg font-semibold">{Math.min(phase.profitProgress, 100).toFixed(0)}%</p>
                                {phase.profitProgress >= 100 && (
                                  <CheckCircle2 className="h-4 w-4 text-long" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Best & Worst Trades */}
                          {(phase.bestTrade || phase.worstTrade) && phase.totalTrades > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t">
                              {phase.bestTrade && (
                                <div className="flex items-center gap-2 p-2 bg-long/5 rounded-lg border border-long/20">
                                  <div className="p-1.5 bg-long/10 rounded">
                                    <ArrowUpRight className="h-3.5 w-3.5 text-long" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Best Trade</p>
                                    <p className="text-sm font-semibold text-long">
                                      {phase.bestTrade.symbol} • {formatCurrency(phase.bestTrade.pnl)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {phase.worstTrade && (
                                <div className="flex items-center gap-2 p-2 bg-destructive/5 rounded-lg border border-destructive/20">
                                  <div className="p-1.5 bg-destructive/10 rounded">
                                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Worst Trade</p>
                                    <p className="text-sm font-semibold text-destructive">
                                      {phase.worstTrade.symbol} • {formatCurrency(phase.worstTrade.pnl)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {phase.status === 'pending' && (
                        <p className="text-sm text-muted-foreground italic">
                          Waiting for previous phase completion
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Breach History */}
      {breaches && breaches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Breach History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breaches.map((breach: any) => (
                <div key={breach.id} className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div>
                    <div className="font-medium text-destructive">
                      {(breach?.breachType || 'drawdown').replace('_', ' ').toUpperCase()} BREACH
                    </div>
                    <div className="text-sm text-destructive/80">
                      {breach.description}
                    </div>
                    <div className="text-xs text-destructive/60 mt-1">
                      {new Date(breach.breachTime).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-destructive">Amount: {formatCurrency(breach.breachAmount)}</div>
                    <div className="text-sm text-destructive">Limit: {formatCurrency(breach.breachThreshold)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
