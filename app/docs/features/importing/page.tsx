import { FileUp, Link2, ShieldCheck, Webhook } from 'lucide-react'
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
          <li><strong>CSV Upload</strong> - Upload comma-separated trade export files from any broker. Map columns manually if the automatic detection doesn't match.</li>
          <li><strong>TradingView Webhook</strong> - Configure TradingView alerts to send trade data to your JJI webhook endpoint. Supports strategy tester exports.</li>
          <li><strong>Tradovate Sync</strong> - Connect your Tradovate account for automatic trade syncing. Requires API credentials in settings.</li>
          <li><strong>DxFeed Sync</strong> - Direct integration with DxFeed for trade data.</li>
          <li><strong>Rithmic Sync</strong> - Connect Rithmic trading accounts for automated import.</li>
          <li><strong>Thor</strong> - Import from Thor trading platform.</li>
          <li><strong>Match-Trader</strong> - Support for Match-Trader broker platform exports.</li>
          <li><strong>Exness</strong> - Direct Exness account integration.</li>
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
