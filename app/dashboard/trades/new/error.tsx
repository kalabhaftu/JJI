'use client'

import { Button } from '@/components/ui/button'

export default function Error({ reset }: { reset: () => void }) { return <div className="flex h-full flex-col items-center justify-center gap-3"><p>Unable to load trade entry.</p><Button variant="secondary" onClick={reset}>Try again</Button></div> }
