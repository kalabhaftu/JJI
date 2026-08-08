import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function ImportingDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Trade Import"
      description="Import your trade history from broker exports, CSV files, TradingView webhooks, and supported platforms. All imports go through a review step before being saved."
    >
      <DocsSection title="Supported import sources">
        <ul>
          <li><strong>CSV &amp; File Upload:</strong> Ingest CSV exports from NinjaTrader 8, Tradovate, Rithmic, Interactive Brokers, Webull, Thor, Match-Trader, and Exness. Includes an interactive column mapper for custom CSV formats.</li>
          <li><strong>TradingView Webhook:</strong> Receive real-time trade alerts and strategy executions directly from TradingView alerts configured with your account webhook token.</li>
          <li><strong>Direct Broker Sync (Under Development):</strong> Direct live API synchronizations (e.g. Tradovate API, Rithmic direct feeds) are currently disabled while under active development. Import trades from these platforms using CSV exports or webhooks.</li>
        </ul>
      </DocsSection>

      <DocsSection title="How to import">
        <ol className="space-y-4">
          <li><strong>Navigate to Import</strong> - Click the import button in the dashboard navbar or go to the import page from the sidebar.</li>
          <li><strong>Choose source</strong> - Select your import source from the available options. Upload a file or configure a webhook/sync connection.</li>
          <li><strong>Review parsed data</strong> - The importer will parse your file and display the detected trades. Check that dates, instruments, P&L, and account mapping are correct. Fix any misaligned columns using the column mapper.</li>
          <li><strong>Select destination account</strong> - Choose which live or prop-firm account the trades belong to. This ensures dashboard filters and reports show the correct data.</li>
          <li><strong>Save</strong> - Commit the import. The trades are now in your account and will appear in the dashboard, trade table, and journal.</li>
        </ol>
      </DocsSection>

      <DocsSection title="After import">
        <ul>
          <li>Verify active account filters are set to include the destination account.</li>
          <li>Open the dashboard to confirm KPI totals reflect the new data.</li>
          <li>Check the trade table to review individual records.</li>
          <li>Use the data management page for any post-import cleanup.</li>
        </ul>
      </DocsSection>

      <DocsCallout title="Tip" tone="success">
        Always review the parsed preview before saving. The importer tries to auto-detect columns, but date formats, currency symbols, and custom instrument names may need manual correction.
      </DocsCallout>
    </DocsPage>
  )
}
