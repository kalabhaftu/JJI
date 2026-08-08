import { Brain01Icon, Calendar01Icon, Dollar01Icon, SlidersHorizontalIcon, ChartIncreaseIcon } from '@hugeicons/core-free-icons'
import type { AnalysisTemplate } from './types'

export const analysisTemplates: AnalysisTemplate[] = [
  {
    id: 'performance',
    title: 'Performance review',
    icon: ChartIncreaseIcon,
    description: 'Find the behaviors behind your strongest and weakest results.',
    prompt: 'Analyze my trading performance over the selected period. Identify strengths, weaknesses, recurring mistakes, and improvement opportunities.',
    dataSources: ['trades', 'performance'],
  },
  {
    id: 'risk',
    title: 'Risk consistency',
    icon: Dollar01Icon,
    description: 'Review sizing, drawdowns, and asymmetric loss patterns.',
    prompt: 'Calculate my risk per trade across all selected accounts. Identify accounts with inconsistent risk management or sizing errors.',
    dataSources: ['trades', 'statistics', 'performance'],
  },
  {
    id: 'psychology',
    title: 'Psychology review',
    icon: Brain01Icon,
    description: 'Connect journal states to execution quality and outcomes.',
    prompt: 'Analyze my journal notes and identify recurring emotional patterns affecting performance.',
    dataSources: ['journals'],
  },
  {
    id: 'strategy',
    title: 'Strategy expectancy',
    icon: SlidersHorizontalIcon,
    description: 'Compare expectancy, profit factor, and win rate by setup.',
    prompt: 'Evaluate the performance of my strategy setups. Highlight expectancy, profit factor, win rate, and potential decay.',
    dataSources: ['trades', 'performance'],
  },
  {
    id: 'monthly',
    title: 'Monthly review',
    icon: Calendar01Icon,
    description: 'Build a complete execution and discipline review.',
    prompt: 'Generate a comprehensive monthly trading review. Synthesize trade execution quality, news trading behavior, and drawdown recovery.',
    dataSources: ['trades', 'journals', 'reviews', 'performance', 'statistics'],
  },
]

export const followUpSuggestions: Record<string, string[]> = {
  default: ['Analyze losing trades', 'Review risk management', 'Find recurring mistakes', 'Compare with the previous month'],
  performance: ['Analyze my worst losers this month', 'What hours do I lose the most money?', 'Show trades where I broke rules', 'How can I improve my win rate?'],
  risk: ['How do I stop letting losers run?', 'Compare my average win and loss', 'Analyze my funded-account drawdown', 'Is my position sizing consistent?'],
  psychology: ['Which trades followed frustration?', 'Compare focused and anxious sessions', 'Identify overtrading patterns', 'Recommend a discipline exercise'],
}

export const dataSourceOptions = [
  { id: 'trades', label: 'Trades' },
  { id: 'journals', label: 'Journal' },
  { id: 'performance', label: 'Performance' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'reviews', label: 'Reviews' },
]
