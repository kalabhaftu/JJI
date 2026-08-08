import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function DashboardDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Dashboard"
      description="The dashboard is your main analytics workspace. It combines KPI cards, chart widgets, filters, calendar views, and templates into one customizable surface."
    >
      <DocsSection title="KPI row">
        <p>The top row displays key performance indicators for the currently filtered data set. KPIs include:</p>
        <ul>
          <li><strong>Total P&amp;L</strong> - Net profit or loss for the filtered period</li>
          <li><strong>Win Rate</strong> - Percentage of profitable trades</li>
          <li><strong>Profit Factor</strong> - Gross profit divided by gross loss</li>
          <li><strong>Total Trades</strong> - Grouped execution count (not raw rows)</li>
          <li><strong>Avg RR</strong> - Average risk-to-reward ratio</li>
          <li><strong>Max Drawdown</strong> - Largest peak-to-trough decline</li>
        </ul>
        <p>KPI cards are responsive: they scale down for narrow screens and expand on wide viewports.</p>
      </DocsSection>

      <DocsSection title="Analytics widgets">
        <p>Widgets below the KPI row provide deeper analysis:</p>
        <ul>
          <li><strong>Equity Curve</strong> - Cumulative P&amp;L over time with drawdown shading</li>
          <li><strong>Drawdown Chart</strong> - Visual drawdown periods with recovery</li>
          <li><strong>Distribution</strong> - P&amp;L distribution histogram</li>
          <li><strong>Instrument Breakdown</strong> - Performance by instrument/symbol</li>
          <li><strong>Monthly P&amp;L</strong> - Monthly profit/loss heatmap</li>
          <li><strong>Day of Week</strong> - Performance broken down by weekday</li>
        </ul>
      </DocsSection>

      <DocsSection title="Dashboard filters">
        <p>Filters control what data appears across the dashboard, reports, and journal:</p>
        <ul>
          <li><strong>Account filter</strong> - Select which live and prop-firm accounts to include</li>
          <li><strong>Date range</strong> - Set custom date ranges or use presets (Today, This Week, This Month, etc.)</li>
          <li><strong>Additional filters</strong> - Filter by instrument, tag, model, setup, and outcome</li>
        </ul>
        <p>All widgets and KPIs update automatically when filters change.</p>
      </DocsSection>

      <DocsSection title="Templates and edit mode">
        <p>You can save multiple dashboard layouts as templates:</p>
        <ul>
          <li>Enter <strong>Edit Mode</strong> by clicking the edit button in the dashboard toolbar</li>
          <li>Drag and drop widgets to rearrange them</li>
          <li>Resize widgets using the resize handles</li>
          <li>Save the current layout as a named template</li>
          <li>Switch between templates from the template selector</li>
        </ul>
      </DocsSection>

      <DocsSection title="Calendar">
        <p>The calendar widget shows daily P&amp;L with color coding (green for profit, red for loss). Click a day to open the daily review modal, which shows:</p>
        <ul>
          <li>Day's trades</li>
          <li>Journal entry (if one exists)</li>
          <li>Notes and screenshots</li>
          <li>Running P&amp;L context</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
