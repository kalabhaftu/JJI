import PublicLayout from '@/components/layouts/public-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, MessageSquare, BookOpen, Heart } from 'lucide-react'
import { getSiteUiSettings } from '@/server/site-ui-settings'
import { BRAND } from '@/lib/constants/brand'

export const metadata = {
  title: `Contact | ${BRAND.name}`,
  description: `Contact the ${BRAND.fullName} team for support, feedback, and questions.`,
}

export default async function ContactPage() {
  const siteUiSettings = await getSiteUiSettings()

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            Contact
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Get in touch with us</p>
        </div>

        <div className="grid gap-4">
          {siteUiSettings.showFeedbackButton && (
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">Feedback & Bug Reports</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Found a bug or have a feature idea? Use our feedback form to let us know directly.
                    </p>
                    <Button asChild size="sm">
                      <Link href="/feedback">Open Feedback Form</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">Documentation & Help</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Check our docs for guides, tutorials, and troubleshooting help.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/docs">Browse Docs</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {siteUiSettings.showDonateButton && (
            <Card className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <Heart className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">Support the Project</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Want to support the ongoing development of JJI? Consider a crypto donation.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/donate">Donate</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            For direct inquiries:{' '}
            <a href="mailto:justjournalit1@gmail.com" className="text-primary hover:underline">justjournalit1@gmail.com</a>
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
