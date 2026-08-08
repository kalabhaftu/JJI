import React from 'react'
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
import UniversalProcessor from '../universal/universal-processor'
import ManualTradeForm from '../manual-trade-entry/manual-trade-form'
import { RithmicSyncWrapper } from '../rithmic/sync/rithmic-sync-connection'
import { TradovateSync } from '../tradovate/sync/tradovate-sync'
import { DxFeedSync } from '../dxfeed/sync/dxfeed-sync'
import { ThorSync } from '../thor/thor-sync'
import { Step } from '../import-button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, MagicWand01Icon, SparklesIcon } from '@hugeicons/core-free-icons'
import { DIRECT_SYNC_STATUS } from '@/lib/integrations/direct-sync-status'

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
  | typeof UniversalProcessor
  | typeof ManualTradeForm
  | typeof RithmicSyncWrapper
  | typeof TradovateSync
  | typeof DxFeedSync
  | typeof ThorSync

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
      component: () => <HugeiconsIcon icon={Add01Icon} className="w-4 h-4"  strokeWidth={2}/>,
    },
    customComponent: ManualTradeForm,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      }
    ]
  },
  {
    platformName: 'universal-csv',
    type: 'universal',
    name: 'Universal Import',
    description: 'Auto-detect and import from any trading platform CSV',
    category: 'Intelligent Import',
    videoUrl: '',
    details: 'Supports: Tradezella, Tradovate, NinjaTrader, FTMO, Topstep, Exness, Match Trader, MetaTrader 4/5, cTrader, TradingView, Rithmic, Sierra Chart, Quantower, TradeStation, ThinkOrSwim, Interactive Brokers, and more.',
    logo: {
      component: () => <HugeiconsIcon icon={MagicWand01Icon} className="w-4 h-4"  strokeWidth={2}/>,
    },
    requiresAccountSelection: true,
    processFile: processStandardCsv,
    processorComponent: UniversalProcessor,
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
        description: 'Upload your CSV file - we\'ll auto-detect the format',
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
        description: 'Review auto-detected trades',
        component: UniversalProcessor,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'csv-ai',
    type: '',
    name: 'CSV-AI (Manual Mapping)',
    description: 'Import with manual column mapping using AI assistance',
    category: 'Intelligent Import',
    videoUrl: '',
    details: 'Use this if Universal Import cannot detect your CSV format',
    logo: {
      component: () => <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4"  strokeWidth={2}/>,
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
    name: 'Match Trader',
    description: 'Import trades from Match Trader CSV file',
    category: 'Platform CSV Import',
    details: 'Fast import for Match Trader CSV files with auto-detection',
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
  },
  {
    platformName: 'rithmic-sync',
    type: 'rithmic-sync',
    name: 'Rithmic Sync',
    description: 'Live sync is under development',
    category: 'Direct Account Sync',
    details: DIRECT_SYNC_STATUS.message,
    logo: {
      path: '/logos/rithmic.png',
      alt: 'Rithmic Logo'
    },
    isRithmic: true,
    isComingSoon: true,
    customComponent: RithmicSyncWrapper,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'complete',
        title: 'Connect Account',
        description: 'Connect your Rithmic account',
        component: RithmicSyncWrapper,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'thor-sync',
    type: 'thor-sync',
    name: 'Thor Sync',
    description: 'Sync your trades automatically via Thor Copy Trader',
    category: 'Direct Account Sync',
    details: 'Real-time trade copying from Thor Copy Trader agent.',
    logo: {
      path: '/logos/thor.png',
      alt: 'Thor Logo'
    },
    customComponent: ThorSync,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'complete',
        title: 'Connect Account',
        description: 'Connect your Thor account',
        component: ThorSync,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'tradovate-sync',
    type: 'tradovate-sync',
    name: 'Tradovate Sync',
    description: 'Live sync is under development',
    category: 'Direct Account Sync',
    details: DIRECT_SYNC_STATUS.message,
    logo: {
      path: '/logos/tradovate.png',
      alt: 'Tradovate Logo'
    },
    isComingSoon: true,
    customComponent: TradovateSync,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'complete',
        title: 'Connect Account',
        description: 'Connect your Tradovate account',
        component: TradovateSync,
        isLastStep: true
      }
    ]
  },
  {
    platformName: 'dxfeed-sync',
    type: 'dxfeed-sync',
    name: 'DxFeed Sync',
    description: 'Live sync is under development',
    category: 'Direct Account Sync',
    details: DIRECT_SYNC_STATUS.message,
    logo: {
      path: '/logos/dxfeed.png',
      alt: 'DxFeed Logo'
    },
    isComingSoon: true,
    customComponent: DxFeedSync,
    steps: [
      {
        id: 'select-import-type',
        title: 'Select Platform',
        description: 'Choose the platform you want to import from',
        component: ImportTypeSelection
      },
      {
        id: 'complete',
        title: 'Connect Account',
        description: 'Connect your DxFeed account',
        component: DxFeedSync,
        isLastStep: true
      }
    ]
  }
] as const

export type PlatformType = typeof platforms[number]['platformName'] 
