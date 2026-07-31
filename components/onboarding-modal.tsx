'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useData } from '@/context/data-provider'
import logger from "@/lib/logger"

export default function OnboardingModal() {
  const { isFirstConnection, changeIsFirstConnection } = useData()


  const handleClose = async (open: boolean) => {
    if (!open) {
      try {
        await changeIsFirstConnection(false)
      } catch (error) {
        logger.error({ err: error }, 'Failed to update onboarding status')
      }
    }
  }

  return (
    <Dialog open={isFirstConnection} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Welcome to JJI
          </DialogTitle>
          <DialogDescription>
            Track your trades and view analytics about your performance.
          </DialogDescription>
        </DialogHeader>


        <div className="mt-6 flex justify-end">
          <Button onClick={() => handleClose(false)}>
                                                   Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 