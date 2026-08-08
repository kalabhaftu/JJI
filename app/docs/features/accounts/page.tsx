import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function AccountsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Accounts"
      description="Manage your live trading accounts, prop-firm challenges, and master account hierarchies. Accounts power the filter system that scopes your entire dashboard."
    >
      <DocsSection title="Account types">
        <ul>
          <li><strong>Live Accounts</strong> - Standard trading accounts connected to a broker. Use these for your regular trading history.</li>
          <li><strong>Master Accounts</strong> - Prop-firm challenge containers that hold multiple phase accounts.</li>
          <li><strong>Phase Accounts</strong> - Individual phases within a prop-firm challenge (e.g., Phase 1, Phase 2, Funded).</li>
          <li><strong>Demo Accounts</strong> - Practice accounts for simulated trading.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Account management">
        <p>Access accounts from the <strong>Accounts</strong> section in the sidebar, or from the <strong>Data Management</strong> page.</p>
        <h3>Creating accounts</h3>
        <ol>
          <li>Go to Accounts → Add Account</li>
          <li>Select the account type (Live, Prop Firm, Demo)</li>
          <li>Fill in account details: name, broker, starting balance, currency</li>
          <li>Save - the account is now available in filters</li>
        </ol>
        <h3>Managing accounts</h3>
        <ul>
          <li>Edit account details (name, broker, notes)</li>
          <li>Update balance or deposit/withdraw history</li>
          <li>Archive accounts you no longer use</li>
          <li>Delete accounts (removes all associated trade data)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Account filters">
        <p>Account filters appear in the dashboard sidebar and affect every analytics surface:</p>
        <ul>
          <li>Select one or more accounts to view combined performance</li>
          <li>Use <strong>All Accounts</strong> to see everything</li>
          <li>The filter applies to dashboard, reports, journal, and trade table</li>
        </ul>
      </DocsSection>

      <DocsSection title="Mobile account access">
        <p>On the mobile app, accounts are accessible from the Dashboard tab. You can switch between accounts using the account selector at the top of the screen. Prop-firm challenge details are available under the Challenges tab.</p>
      </DocsSection>
    </DocsPage>
  )
}
