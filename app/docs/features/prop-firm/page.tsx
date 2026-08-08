import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function PropFirmDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Prop Firm Tracking"
      description="Track prop-firm challenges, manage phase transitions, monitor drawdown limits, and log payouts - all within your existing dashboard and filter system."
    >
      <DocsSection title="How prop-firm tracking works">
        <p>Prop-firm accounts are organized around <strong>master accounts</strong>. Each master account represents one prop-firm challenge (e.g., FTMO 2-phase $100k). Within a master account, you track individual phases as they progress.</p>
      </DocsSection>

      <DocsSection title="Account lifecycle states">
        <ul>
          <li><strong>Active</strong> - Currently trading a challenge phase</li>
          <li><strong>Passed</strong> - Successfully completed a phase</li>
          <li><strong>Funded</strong> - Passed all phases and received funding</li>
          <li><strong>Failed</strong> - Breached a rule and the challenge is over</li>
          <li><strong>Pending Approval</strong> - Awaiting verification after passing</li>
        </ul>
      </DocsSection>

      <DocsSection title="Phase objectives">
        <p>Each phase can have configurable objectives:</p>
        <ul>
          <li><strong>Profit Target</strong> - Gross profit goal (e.g., 10% of starting capital)</li>
          <li><strong>Max Drawdown</strong> - Maximum allowed equity drawdown (e.g., 5% or 10%)</li>
          <li><strong>Daily Loss Limit</strong> - Maximum loss allowed in a single trading day</li>
          <li><strong>Minimum Trading Days</strong> - Minimum number of days required before passing</li>
          <li><strong>Profit Target Split</strong> - For 2-phase challenges, tracking targets per phase</li>
        </ul>
      </DocsSection>

      <DocsSection title="Managing prop-firm accounts">
        <ol>
          <li>Go to <strong>Accounts → Prop Firm</strong> to view your master accounts</li>
          <li>Click <strong>Add Account</strong> to create a new challenge tracker</li>
          <li>Configure phase objectives based on your prop firm's rules</li>
          <li>Import or enter trades against the appropriate phase account</li>
          <li>Track progress through the prop-firm dashboard widgets</li>
        </ol>
      </DocsSection>

      <DocsSection title="Prop-firm widgets">
        <p>Dashboard widgets available for prop-firm tracking:</p>
        <ul>
          <li><strong>Challenge Progress</strong> - Visual progress toward profit target with drawdown indicator</li>
          <li><strong>Phase Timeline</strong> - History of phase transitions</li>
          <li><strong>Payout Tracker</strong> - Log and track received payouts</li>
          <li><strong>Rule Compliance</strong> - Summary of whether current trading stays within challenge rules</li>
        </ul>
      </DocsSection>

      <DocsCallout title="Important" tone="warning">
        Profit-target progress uses gross progress (sum of winning trades) rather than net P&amp;L. This matches how most prop firms calculate challenge completion. Your dashboard realized P&amp;L may differ from challenge progress.
      </DocsCallout>
    </DocsPage>
  )
}
