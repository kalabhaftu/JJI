import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function ReportsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Reports & Sharing"
      description="Generate detailed performance reports with multiple chart types, customize the view, and share read-only report links with others."
    >
      <DocsSection title="Report types">
        <ul>
          <li><strong>Performance Summary</strong> - Overall stats: P&amp;L, win rate, profit factor, trades, drawdown</li>
          <li><strong>Equity Analysis</strong> - Equity curve with detailed drawdown periods</li>
          <li><strong>Trade Distribution</strong> - P&amp;L histogram, trade duration analysis</li>
          <li><strong>Instrument Analysis</strong> - Breakdown by symbol/instrument</li>
          <li><strong>Time-based Analysis</strong> - Performance by day of week, hour, month</li>
          <li><strong>Setup/Model Analysis</strong> - Performance grouped by assigned setups and models</li>
          <li><strong>Prop Firm Report</strong> - Challenge-specific reporting with rule compliance</li>
        </ul>
      </DocsSection>

      <DocsSection title="Creating a report">
        <ol>
          <li>Open <strong>Reports</strong> from the dashboard sidebar</li>
          <li>Select the report type from the available options</li>
          <li>Apply account filters and date range (inherits from dashboard by default)</li>
          <li>Toggle which metrics and charts to include</li>
          <li>Optional: add notes or annotations</li>
          <li>Generate the report</li>
        </ol>
      </DocsSection>

      <DocsSection title="Sharing reports">
        <p>Reports can be shared as read-only public links:</p>
        <ol>
          <li>Generate the report with your desired metrics</li>
          <li>Click <strong>Share</strong></li>
          <li>Configure sharing options: expiration date (optional), password protection (optional)</li>
          <li>Copy the share link and send it to anyone</li>
        </ol>
        <p>Shared reports show the exact charts and metrics you configured. The recipient does not need a JJI account to view a shared report.</p>
      </DocsSection>

      <DocsSection title="Exporting reports">
        <p>Reports can be exported in multiple formats:</p>
        <ul>
          <li><strong>PDF</strong> - Print-ready report with all charts and tables</li>
          <li><strong>CSV</strong> - Raw data export for spreadsheet analysis</li>
          <li><strong>PNG</strong> - Chart screenshots</li>
        </ul>
      </DocsSection>

      <DocsCallout title="Tip" tone="success">
        Use sharing to collaborate with a mentor or trading coach. The read-only link gives them access to your performance data without exposing your account credentials.
      </DocsCallout>
    </DocsPage>
  )
}
