import { SubscribeClient } from './subscribe-client'
import { isWhopCheckoutConfigured } from '@/lib/services/whop/config'

export const metadata = {
  title: 'Subscribe | JJI Pro',
  description: 'Unlock full access to JJI.'
}

export default function SubscribePage() {
  return <SubscribeClient whopEnabled={isWhopCheckoutConfigured()} />
}
