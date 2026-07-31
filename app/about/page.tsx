import PublicLayout from '@/components/layouts/public-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Heart, Github, Mail, Target, Shield, Zap } from 'lucide-react'
import { getSiteUiSettings } from '@/server/site-ui-settings'

export default async function AboutPage() {
  const siteUiSettings = await getSiteUiSettings()

  return (
    <PublicLayout>
      <div className="space-y-10">
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">About JJI</h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            A trading analytics platform built for traders who want 
            to journal and analyze their performance.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Target, title: 'Mission', desc: 'Make trade journaling accessible to every trader.' },
            { icon: Shield, title: 'Privacy First', desc: 'Your trading data stays yours. No selling data, no third-party analytics, no hidden tracking.' },
            { icon: Zap, title: 'Built for Traders', desc: 'Maintained with a commitment to stable performance and clean design.' },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="pt-6 text-center">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">The Story</h2>
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                JJI (Just Journal It) started as a personal trading workflow project and grew into a dedicated
                analytics platform shaped around real journaling, review, and performance-tracking needs.
                Over months of development, the product evolved from a simple tracker into a full trading
                dashboard with account management, reports, playbooks, reviews, and data controls.
              </p>
              <p>
                As a CFD trader myself, I know how hard it is to properly journal trades and visualize 
                performance. That's why I built this platform. (Note: JJI is currently closed-source, but may be open-sourced in the future.)
              </p>
              <p>
                The platform is designed for stability and speed to help traders track their trading discipline and analyze their edge.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-4">
          {siteUiSettings.showDonateButton && (
            <Button asChild size="lg">
              <Link href="/donate"><Heart className="h-4 w-4 mr-2" />Support the Project</Link>
            </Button>
          )}
          {siteUiSettings.showFeedbackButton && (
            <Button asChild variant="outline" size="lg">
              <Link href="/feedback"><Mail className="h-4 w-4 mr-2" />Send Feedback</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/docs"><Zap className="h-4 w-4 mr-2" />Read the Docs</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}
