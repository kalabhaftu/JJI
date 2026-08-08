'use client'

import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, SmartPhone01Icon } from '@hugeicons/core-free-icons'
import { Button } from './ui/button'

export function AppBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isBannerDismissed = localStorage.getItem('jji_app_banner_dismissed') === 'true'
    
    if (isMobile && !isBannerDismissed) {
      setShow(true)
    }
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('jji_app_banner_dismissed', 'true')
  }

  const handleOpenApp = () => {
    const path = window.location.pathname + window.location.search
    const deepLinkUrl = `jji://open?path=${encodeURIComponent(path)}`
    window.location.href = deepLinkUrl
  }

  if (!show) return null

  return (
      <aside
        aria-label="Open the native app"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto flex max-w-md animate-in items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 shadow-lg fade-in slide-in-from-bottom-3 md:bottom-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={SmartPhone01Icon} className="w-5 h-5 text-primary" strokeWidth={2} color="currentColor" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Open in JJI App</h4>
            <p className="text-xs text-muted-foreground text-left">Get a native charts experience.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleOpenApp} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-8">
            Open
          </Button>
          <button 
            onClick={handleDismiss} 
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Dismiss app banner"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" strokeWidth={2} color="currentColor" />
          </button>
        </div>
      </aside>
  )
}
