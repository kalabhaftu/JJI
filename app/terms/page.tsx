import PublicLayout from '@/components/layouts/public-layout'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Last updated: August 1, 2026</p>
        </div>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Use of JJI</h2>
          <p>
            JJI (Just Journal It) provides trading analytics, journaling, reporting, and account-management tools. It is not financial advice, investment advice, tax advice, or a brokerage service. You are responsible for your trading decisions and for verifying any imported or calculated data before relying on it.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Accounts and data</h2>
          <p>
            You are responsible for keeping your account secure and for the accuracy of the data you upload or enter. You may not use JJI to upload unlawful content, attack the service, bypass security controls, or access another user’s data.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Your content and exports</h2>
          <p>
            You keep responsibility for the trades, notes, screenshots, and other content you submit. JJI gives you tools to export and delete data where those tools are available; keep your own backup of information you cannot afford to lose. Do not upload credentials, secrets, or material you do not have permission to use.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Subscriptions and payments</h2>
          <p>
            Paid features may be processed by third-party payment providers. Subscription access can be changed, suspended, or revoked for failed payments, fraud, abuse, or violation of these terms. Crypto payments may be final once processed by the payment provider or blockchain network.
          </p>
          <p>
            Recurring subscriptions renew until cancelled. You can cancel card renewal from JJI Settings or the provider billing portal and keep access through the paid period. Except for duplicate charges, confirmed technical billing errors, or rights that cannot legally be excluded, completed subscription periods and partial months are non-refundable. Contact us through the <Link href="/contact" className="text-primary hover:underline">contact page</Link> promptly if you believe a charge is incorrect so it can be reviewed before opening a payment dispute.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Availability and liability</h2>
          <p>
            JJI is provided as-is. We work to keep it reliable and secure, but we do not guarantee uninterrupted access, perfect accuracy, or suitability for any specific trading strategy. To the maximum extent allowed by law, JJI is not liable for trading losses, lost profits, data-entry mistakes, import errors, or indirect damages.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Changes and contact</h2>
          <p>
            We may update these terms as the service changes. The latest version is published on this page with its update date. Questions about these terms can be sent through the <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
          </p>
        </section>
      </div>
    </PublicLayout>
  )
}
