export type DirectSyncService = 'Tradovate' | 'DxFeed' | 'Rithmic'

export const DIRECT_SYNC_STATUS = {
  isPaused: true,
  message:
    'Direct broker sync is currently under development. CSV import and TradingView webhooks are still available.',
} as const

export function directSyncUnderDevelopmentMessage(service: DirectSyncService) {
  return `${service} live sync is currently under development. Use CSV import or TradingView webhooks for now.`
}

export function directSyncUnavailablePayload(service: DirectSyncService) {
  return {
    success: false,
    underDevelopment: true,
    message: directSyncUnderDevelopmentMessage(service),
  }
}
