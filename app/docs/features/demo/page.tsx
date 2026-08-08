import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function DemoDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Demo Mode"
      description="Explore JJI with pre-loaded sample data before committing your own trade history. Demo mode shows you how the dashboard, reports, and journal work with realistic data."
    >
      <DocsSection title="What is demo mode?">
        <p>Demo mode loads a set of sample trades, accounts, and journal entries so you can explore the full JJI experience without importing your own data. It's useful for:</p>
        <ul>
          <li>Evaluating the platform before subscribing</li>
          <li>Learning how features work in a safe environment</li>
          <li>Testing different dashboard layouts and widgets</li>
          <li>Understanding reports and analytics before your own data is available</li>
        </ul>
      </DocsSection>

      <DocsSection title="Entering demo mode">
        <p>From the landing page or sign-in screen, look for the <strong>Try Demo</strong> button. Clicking it loads the demo environment immediately - no account or subscription required.</p>
        <p>Demo mode mimics the full dashboard experience with:</p>
        <ul>
          <li>Sample trade data with realistic P&amp;L, win rates, and drawdowns</li>
          <li>Multiple demo accounts (live and prop-firm)</li>
          <li>Sample journal entries and screenshots</li>
          <li>Pre-configured dashboard widgets and templates</li>
          <li>Working filters and reports</li>
        </ul>
      </DocsSection>

      <DocsSection title="Limitations of demo mode">
        <ul>
          <li>Demo data is shared and resets periodically</li>
          <li>Changes made in demo mode are not saved permanently</li>
          <li>AI chat and certain advanced features may be limited</li>
          <li>You cannot export or share reports from demo mode</li>
        </ul>
      </DocsSection>

      <DocsSection title="Moving from demo to full account">
        <p>When you're ready to start with your own data:</p>
        <ol>
          <li>Click <strong>Sign Up</strong> from the demo mode header</li>
          <li>Create your account</li>
          <li>Choose a subscription plan</li>
          <li>Import your trade data</li>
          <li>Your dashboard will reflect your real performance</li>
        </ol>
      </DocsSection>

      <DocsCallout title="Try the demo" tone="success">
        Demo mode is available to everyone. No credit card, no sign-up required. It's the fastest way to see if JJI fits your trading workflow.
      </DocsCallout>
    </DocsPage>
  )
}
