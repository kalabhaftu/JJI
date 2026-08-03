export interface StatisticsProps {
  breakEvenThreshold: number;
  cumulativeFees: number;
  cumulativePnl: number;
  winningStreak: number;
  winRate: number;
  nbTrades: number;
  nbBe: number;
  nbWin: number;
  nbLoss: number;
  totalPositionTime: number;
  averagePositionTime: string;
  profitFactor: number;
  grossLosses: number;
  grossWin: number;

  biggestWin: number;
  biggestLoss: number;
  averageWin: number;
  averageLoss: number;

  avgWin?: number;
  avgLoss?: number;
  riskRewardRatio?: number;

  totalPayouts: number;
  nbPayouts: number;

  totalPnL: number;
}
