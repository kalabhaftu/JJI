import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function DataExportDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Data Export"
      description="Export your trading data, reports, and analytics in multiple formats for external analysis, backup, or sharing."
    >
      <DocsSection title="Export formats">
        <ul>
          <li><strong>CSV</strong> - Raw trade data export compatible with Excel, Google Sheets, and any spreadsheet application</li>
          <li><strong>Excel (XLSX)</strong> - Formatted spreadsheet with multiple sheets for trades, accounts, and summaries</li>
          <li><strong>PDF</strong> - Print-ready report exports with charts, tables, and formatting</li>
          <li><strong>JSON</strong> - Machine-readable data export for programmatic access</li>
          <li><strong>PNG</strong> - Chart and widget screenshots</li>
        </ul>
      </DocsSection>

      <DocsSection title="Exporting trade data">
        <ol>
          <li>Open the <strong>Trade Table</strong> or <strong>Data Management → Trades</strong></li>
          <li>Apply the filters you want (account, date range, instruments)</li>
          <li>Click <strong>Export</strong></li>
          <li>Choose the export format (CSV, Excel, JSON)</li>
          <li>The file downloads automatically</li>
        </ol>
        <p>The export respects your active filters. If you want all data, clear filters before exporting.</p>
      </DocsSection>

      <DocsSection title="Exporting reports">
        <p>From any report:</p>
        <ol>
          <li>Generate the report with your desired metrics</li>
          <li>Click <strong>Export</strong> in the report toolbar</li>
          <li>Choose PDF or PNG format</li>
          <li>For PDF: select page orientation and included sections</li>
          <li>For PNG: select which charts to capture</li>
        </ol>
      </DocsSection>

      <DocsSection title="Export from mobile">
        <p>The mobile app supports CSV export from the Trades tab. For full report exports (PDF, Excel), use the web dashboard.</p>
      </DocsSection>

      <DocsCallout title="Data portability" tone="success">
        You own your data. Export at any time - there are no limits on how often you can export or how much data you can download.
      </DocsCallout>
    </DocsPage>
  )
}
