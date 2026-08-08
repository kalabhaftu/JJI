import type { TradeType } from '@/lib/db/schema/trades';

import type { ComponentType } from 'react'
import ImportTypeSelection from '../import-type-selection'
import FileUpload from '../file-upload'
import HeaderSelection from '../header-selection'
import AccountSelection from '../account-selection'
import ColumnMapping from '../column-mapping'
import { FormatPreview } from '../components/format-preview'
import MatchTraderProcessor from '../match-trader/match-trader-processor'
import ExnessProcessor from '../exness/exness-processor'
import ManualTradeFormCard from '../manual-trade-entry/manual-trade-form-card'
import { Step } from '../import-button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SparklesIcon, Add01Icon } from '@hugeicons/core-free-icons'

type StepText = string

export interface ProcessedData {
  headers: string[]
  processedData: string[][]
}

type StepComponent = 
  | typeof ImportTypeSelection
  | typeof FileUpload
  | typeof HeaderSelection
  | typeof AccountSelection
  | typeof ColumnMapping
  | typeof FormatPreview
  | typeof MatchTraderProcessor
  | typeof ManualTradeFormCard

export interface PlatformConfig {
  platformName: string
  type: string
  name: string
  description: string
  category: 'Direct Account Sync' | 'Intelligent Import' | 'Platform CSV Import'
  videoUrl?: string
  details: string
  logo: {
    path?: string
    alt?: string
    component?: ComponentType<{}>
  }
  isDisabled?: boolean
  isComingSoon?: boolean
  isRithmic?: boolean
  skipHeaderSelection?: boolean
  requiresAccountSelection?: boolean
  processFile?: (data: string[][]) => ProcessedData
  customComponent?: ComponentType<{ setIsOpen: React.Dispatch<React.SetStateAction<boolean>>; onBack?: () => void }>
  customCardComponent?: ComponentType<{ accountId: string }>
  processorComponent?: ComponentType<{
    csvData: string[][]
    headers: string[]
    setProcessedTrades: React.Dispatch<React.SetStateAction<TradeType[]>>
    accountNumber: string
  }>
  tutorialLink?: string
  steps: {
    id: Step
    title: StepText
    description: StepText
    component: StepComponent
    isLastStep?: boolean
  }[]
}


const processStandardCsv = (data: string[][]): ProcessedData => {
  if (data.length === 0) {
    throw new Error("The CSV file appears to be empty or invalid.")
  }
  const headers = data[0]!.filter(header => header && header.trim() !== '')
  return { headers, processedData: data.slice(1) };
}

const processMatchTraderCsv = (data: string[][]): ProcessedData => {
  if (data.length === 0) {
    throw new Error("The CSV file appears to be empty or invalid.")
  }
  

  const expectedHeaders = ['ID', 'Symbol', 'Open time', 'Volume', 'Side', 'Close time', 'Open price', 'Close Price', 'Stop loss', 'Take profit', 'Swap', 'Commission', 'Profit', 'Reason']
  const headers = data[0]!.filter(header => header && header.trim() !== '')
  

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  const hasRequiredHeaders = ['Symbol', 'Open time', 'Close time', 'Volume', 'Side', 'Profit'].every(
    requiredHeader => normalizedHeaders.some(header => header.includes(requiredHeader.toLowerCase().trim()))
  )
  
  if (!hasRequiredHeaders) {
    throw new Error("This doesn't appear to be a valid Match Trader CSV file. Please ensure it contains the expected columns.")
  }
  
  return { headers, processedData: data.slice(1) };
};

const processExnessCsv = (data: string[][]): ProcessedData => {
  if (data.length === 0) {
    throw new Error("The CSV file appears to be empty or invalid.")
  }
  

  const headers = data[0]!.filter(header => header && header.trim() !== '')
  

  const hasRequiredHeaders = ['ticket', 'opening_time_utc', 'closing_time_utc', 'type', 'lots', 'symbol', 'opening_price', 'closing_price'].every(
    requiredHeader => headers.some(header => header.includes(requiredHeader))
  ) && headers.some(header => header.includes('profit'))
  
  if (!hasRequiredHeaders) {
    throw new Error("This doesn't appear to be a valid Exness CSV file. Please ensure it contains the expected columns.")
  }
  
  return { headers, processedData: data.slice(1) };
};

export const platforms: PlatformConfig[] = [
  {
    platformName: 'manual-trade-entry',
    type: 'manual-trade-entry',
    name: 'Manual Trade Entry',
    description: 'Add a single trade manually with complete details',
    category: 'Intelligent Import',
    videoUrl: '',
    details: 'Perfect for manual journal entries with all trade context and analysis',
    logo: {
      component: () => <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" strokeWidth={2} color="currentColor" />,
    },
    customCardComponent: ManualTradeFormCard,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'preview-trades',
        title: 'Review Trades',
        description: 'Review the trades that will be imported',
        component: ManualTradeFormCard,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'csv-ai',
    type: '',
    name: 'CSV-AI',
    description: 'Import trades from any CSV file using AI',
    category: 'Intelligent Import',
    videoUrl: '',
    details: '',
    logo: {
      component: () => <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4" strokeWidth={2} color="currentColor" />,
    },
    requiresAccountSelection: true,
    processFile: processStandardCsv,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'upload-file',
        title: 'Upload File',
        description: 'Upload the CSV file you want to import',
        component: FileUpload
      },
      {
        id: 'map-columns',
        title: 'Map Columns',
        description: 'Map the columns in your CSV to the required fields',
        component: ColumnMapping
      },
      {
        id: 'select-account',
        title: 'Select Account',
        description: 'Select the account you want to import the trades to',
        component: AccountSelection
      },
      {
        id: 'preview-trades',
        title: 'Review Trades',
        description: 'Review the trades that will be imported',
        component: FormatPreview,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'match-trader',
    type: 'match-trader',
    name: 'import.type.matchTrader.name',
    description: 'import.type.matchTrader.description',
    category: 'Platform CSV Import',
    details: 'import.type.matchTrader.details',
    logo: {
      path: '/logos/match-trader.png',
      alt: 'Match Trader Logo'
    },
    requiresAccountSelection: true,
    processFile: processMatchTraderCsv,
    processorComponent: MatchTraderProcessor,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'upload-file',
        title: 'Upload File',
        description: 'Upload the CSV file you want to import',
        component: FileUpload
      },
      {
        id: 'select-account',
        title: 'Select Account',
        description: 'Select the account you want to import the trades to',
        component: AccountSelection
      },
      {
        id: 'preview-trades',
        title: 'Process Trades',
        description: 'Processing your trades',
        component: MatchTraderProcessor,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'exness',
    type: 'exness',
    name: 'Exness',
    description: 'Import trades from Exness CSV file',
    category: 'Platform CSV Import',
    details: 'Fast import for Exness CSV files with auto-detection',
    logo: {
      path: '/logos/exness-icon.png',
      alt: 'Exness Logo'
    },
    requiresAccountSelection: true,
    processFile: processExnessCsv,
    processorComponent: ExnessProcessor,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'upload-file',
        title: 'Upload File',
        description: 'Upload the CSV file you want to import',
        component: FileUpload
      },
      {
        id: 'select-account',
        title: 'Select Account',
        description: 'Select the account you want to import the trades to',
        component: AccountSelection
      },
      {
        id: 'preview-trades',
        title: 'Process Trades',
        description: 'Processing your trades',
        component: ExnessProcessor,
        isLastStep: true
      }
    ]
  }
] as const

export type PlatformType = typeof platforms[number]['platformName']
