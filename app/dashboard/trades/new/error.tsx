'use client'

export default function Error({ reset }: { reset: () => void }) { return <div className="flex h-full flex-col items-center justify-center gap-3"><p>Unable to load trade entry.</p><button className="underline" onClick={reset}>Try again</button></div> }
