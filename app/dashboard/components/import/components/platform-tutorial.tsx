'use client'

import { AlertCircle, ExternalLink } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { PlatformConfig } from "../config/platforms"
import { Button } from "@/components/ui/button"

interface PlatformTutorialProps {
  selectedPlatform: PlatformConfig | undefined
  setIsOpen: (isOpen: boolean) => void
}

export function PlatformTutorial({ selectedPlatform, setIsOpen }: PlatformTutorialProps) {
  const videoRef = useRef<HTMLVideoElement>(null)


  useEffect(() => {
    const video = videoRef.current
    if (!video) return


    video.pause()
    video.currentTime = 0

    if (selectedPlatform?.videoUrl) {

      video.load()
      const playVideo = () => {
        video.play().catch((error) => {
        })
      }


      if (video.readyState >= 2) {
        playVideo()
      } else {
        video.addEventListener('loadeddata', playVideo, { once: true })
      }
    }

    return () => {
      if (video) {
        video.pause()
        video.removeEventListener('loadeddata', () => {})
      }
    }
  }, [selectedPlatform])

  if (!selectedPlatform) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Tutorial Guide</h3>
        {selectedPlatform.tutorialLink && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs h-8 border-border/50 hover:bg-muted"
            onClick={() => window.open(selectedPlatform.tutorialLink, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Documentation</span>
          </Button>
        )}
      </div>

      {selectedPlatform.videoUrl ? (
        <div className="space-y-2">
          <div className="aspect-video rounded-xl overflow-hidden bg-muted/30 border border-border/40 shadow-sm transition-transform duration-300 hover:scale-[1.01]">
            <video
              ref={videoRef}
              preload="metadata"
              loop
              muted
              controls
              playsInline
              className="w-full h-full object-cover"
            >
              <source src={selectedPlatform.videoUrl} type="video/mp4" />
              <track
                kind="subtitles"
                srcLang="en"
                label="English"
              />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed px-1">
            Watch the video above to learn how to export and sync trades from {selectedPlatform.name}.
          </p>
        </div>
      ) : null}

      {selectedPlatform.details && (
        <div className="text-xs text-muted-foreground flex items-start gap-2.5 bg-muted/20 border border-border/30 p-4 rounded-xl transition-all duration-200 hover:bg-muted/30 animate-in slide-in-from-bottom-4">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-warning opacity-90 animate-pulse" />
          <p className="leading-relaxed">{selectedPlatform.details}</p>
        </div>
      )}

      {selectedPlatform.isRithmic && (
        <div className="mt-6 text-xs text-muted-foreground space-y-2 border-t pt-4">
          <div className="flex items-center gap-4 mb-2">
            <Image 
              src="/RithmicArtwork/TradingPlatformByRithmic-Black.png"
              alt="Trading Platform by Rithmic"
              width={120}
              height={40}
              className="hidden"
            />
            <Image 
              src="/RithmicArtwork/TradingPlatformByRithmic-Green.png"
              alt="Trading Platform by Rithmic"
              width={120}
              height={40}
              className="block"
            />
            <Image 
              src="/RithmicArtwork/Powered_by_Omne.png"
              alt="Powered by OMNE"
              width={120}
              height={40}
            />
          </div>
          <p>Platform specific tutorial content</p>
          <p>© Omne Trading Platform</p>
        </div>
      )}
    </div>
  )
} 