import { SubscribeClient } from './subscribe-client'
import { isWhopCheckoutConfigured } from '@/lib/services/whop/config'

export const metadata = {
  title: 'Subscribe',
  description: 'Unlock full access to JJI.'
}

export default function SubscribePage() {
  return <SubscribeClient whopEnabled={isWhopCheckoutConfigured()} />
}
