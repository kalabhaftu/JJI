import { EventSchemas, Inngest } from 'inngest'
import type { JjiInngestEvents } from '@/lib/inngest/events'

export const inngest = new Inngest({
  id: 'jji',
  schemas: new EventSchemas().fromRecord<JjiInngestEvents>(),
})
