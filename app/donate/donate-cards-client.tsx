'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getTokenMeta } from '@/lib/constants/crypto-tokens'
import { apiRequestData } from '@/lib/api/client'
import { reportError } from '@/lib/observability/report-error'

interface DonationAddr {
  token: string
  network: string
  address: string
}

export function DonateCardsClient() {
  const [addresses, setAddresses] = useState<DonationAddr[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiRequestData<DonationAddr[]>('/api/v1/donations', {
      method: 'GET',
      retry: { mode: 'safe' },
      operation: 'load-donation-addresses',
    })
      .then(data => { setAddresses(data ?? []) })
      .catch((e) => {
        reportError(e, {
          surface: 'client',
          operation: 'load-donation-addresses',
          route: '/api/v1/donations',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const copyToClipboard = async (address: string, index: number) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedIndex(index)
      toast.success('Address copied!')
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'copy-donation-address',
      })
      toast.error('Failed to copy')
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (addresses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No donation addresses are configured yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {addresses.map((addr, index) => {
        const meta = getTokenMeta(addr.token)
        const isCopied = copiedIndex === index

        return (
          <Card key={index} className="group hover:border-primary/30 transition-colors overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 p-2.5 rounded-xl"
                  style={{ backgroundColor: `${meta.color}15` }}
                >
                  {meta.logo ? (
                    <Image
                      src={meta.logo}
                      alt={meta.name}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.symbol.slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm">{meta.name}</span>
                    <Badge variant="outline" className="text-[10px] font-medium" style={{ borderColor: `${meta.color}40`, color: meta.color }}>
                      {addr.network}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-1.5 rounded flex-1 truncate select-all">
                      {addr.address}
                    </code>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={isCopied ? `${meta.name} address copied` : `Copy ${meta.name} address`}
                      title={isCopied ? "Copied" : "Copy address"}
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyToClipboard(addr.address, index)}
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
