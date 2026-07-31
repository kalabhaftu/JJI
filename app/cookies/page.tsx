import PublicLayout from '@/components/layouts/public-layout'

export default function CookiesPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Cookie and Storage Policy</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Last updated: July 2, 2026</p>
        </div>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Essential storage</h2>
          <p>
            JJI uses essential cookies, local storage, and session storage to keep you signed in, secure your session, remember preferences such as theme and layout, support offline/PWA behavior, and make the application work correctly.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">No advertising cookies</h2>
          <p>
            JJI does not use advertising cookies. Production monitoring or error reporting may collect technical diagnostics when configured, but those tools are used to operate and secure the service rather than to sell ads.
          </p>
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">Managing storage</h2>
          <p>
            You can clear cookies and local storage in your browser settings. Clearing essential storage may sign you out, reset preferences, or disable offline behavior until the app stores those values again.
          </p>
        </section>
      </div>
    </PublicLayout>
  )
}
