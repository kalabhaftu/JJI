import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function TradeTableDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Trade Table"
      description="The trade table is the detailed record view for all your executions. Inspect grouped trades, edit notes and media, apply filters, and manage your trade history."
    >
      <DocsSection title="Opening the trade table">
        <p>Navigate to <strong>Trades</strong> from the dashboard sidebar or use the command palette (Ctrl/Cmd + K) and search for "Trades".</p>
      </DocsSection>

      <DocsSection title="Table layout">
        <p>The trade table displays trades in a sortable, filterable virtual table. Columns include:</p>
        <ul>
          <li><strong>Date/Time</strong> - When the trade was executed</li>
          <li><strong>Instrument</strong> - Symbol or instrument name</li>
          <li><strong>Direction</strong> - Long or Short</li>
          <li><strong>Quantity</strong> - Number of units/contracts</li>
          <li><strong>Entry Price</strong> - Open price</li>
          <li><strong>Exit Price</strong> - Close price</li>
          <li><strong>P&amp;L</strong> - Realised profit or loss</li>
          <li><strong>Tags</strong> - Assigned tags and models</li>
          <li><strong>Notes</strong> - Trade notes indicator</li>
          <li><strong>Screenshots</strong> - Image attachment indicator</li>
        </ul>
      </DocsSection>

      <DocsSection title="Filtering and sorting">
        <p>The trade table respects the active dashboard filters by default, but you can also:</p>
        <ul>
          <li>Sort any column by clicking the header</li>
          <li>Use the table-specific filter bar to narrow by instrument, direction, date range, tags, or models</li>
          <li>Search for specific trades using the search box</li>
        </ul>
      </DocsSection>

      <DocsSection title="Editing trades">
        <p>Click any trade row to open the edit panel. From there you can:</p>
        <ul>
          <li>Modify entry and exit details</li>
          <li>Add or edit notes</li>
          <li>Upload or change screenshots</li>
          <li>Assign or remove tags and models</li>
          <li>Change the account association</li>
          <li>Delete the trade record</li>
        </ul>
        <p>Changes save immediately. The edit panel preserves visible form state during saves so images and notes don't disappear during updates.</p>
      </DocsSection>

      <DocsSection title="Trade counts explained">
        <p>Across JJI, UI labels showing <strong>Trades</strong> use grouped execution counts rather than raw imported rows. If a single order fills across multiple partial fills, it counts as one trade. Raw imported rows are available in the table detail view.</p>
      </DocsSection>
    </DocsPage>
  )
}
