import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function DataManagementDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Data Management"
      description="The data management page is the maintenance surface for accounts and trades. Use it when you need to clean up, restructure, or bulk-manage your records."
    >
      <DocsSection title="Accounts tab">
        <p>View and manage all your accounts in one place:</p>
        <ul>
          <li>Review account details (name, broker, balance, currency)</li>
          <li>Edit account metadata</li>
          <li>Archive or delete accounts</li>
          <li>View account-level statistics</li>
          <li>Merge duplicate accounts</li>
        </ul>
      </DocsSection>

      <DocsSection title="Trades tab">
        <p>Bulk trade management tools:</p>
        <ul>
          <li>View all imported trades in a searchable table</li>
          <li>Filter by account, date range, instrument</li>
          <li>Edit individual trade records</li>
          <li>Delete individual or bulk-selected trades</li>
          <li>Re-map trades to different accounts</li>
        </ul>
      </DocsSection>

      <DocsSection title="Data quality indicators">
        <p>The data management page shows warnings for potential issues:</p>
        <ul>
          <li>Trades with missing or unusual P&amp;L values</li>
          <li>Trades mapped to archived accounts</li>
          <li>Duplicate trade detection</li>
          <li>Inconsistent date or instrument formatting</li>
        </ul>
      </DocsSection>

      <DocsSection title="Refreshing dashboard data">
        <p>If dashboard totals look stale after making changes on the data management page, use the <strong>Refresh Data</strong> action in the dashboard sidebar. This recomputes KPIs and widget data from the current records.</p>
      </DocsSection>

      <DocsCallout title="Caution" tone="warning">
        Deleting trades or accounts is permanent. Export your data first if you need a backup.
      </DocsCallout>
    </DocsPage>
  )
}
