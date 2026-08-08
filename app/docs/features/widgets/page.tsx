import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function WidgetsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Widget Customization"
      description="The dashboard widget system lets you arrange, resize, and save multiple dashboard layouts. Each widget shows specific analytics content."
    >
      <DocsSection title="Available widgets">
        <ul>
          <li><strong>KPI Row</strong> - Summary performance cards (P&amp;L, win rate, profit factor, trades, drawdown)</li>
          <li><strong>Equity Curve</strong> - Cumulative P&amp;L chart with drawdown shading</li>
          <li><strong>Drawdown Chart</strong> - Visual drawdown tracking</li>
          <li><strong>P&amp;L Distribution</strong> - Trade outcome histogram</li>
          <li><strong>Monthly P&amp;L</strong> - Month-by-month profit/loss heatmap</li>
          <li><strong>Day of Week</strong> - Performance split by weekday</li>
          <li><strong>Instrument Breakdown</strong> - Per-instrument performance</li>
          <li><strong>Calendar</strong> - Daily P&amp;L calendar with journal links</li>
          <li><strong>Trade Table</strong> - Inline trade record view</li>
          <li><strong>Prop Firm Progress</strong> - Challenge tracking widgets</li>
          <li><strong>Tags/Models</strong> - Performance by tag or model</li>
        </ul>
      </DocsSection>

      <DocsSection title="Using edit mode">
        <ol>
          <li>Click <strong>Edit</strong> in the dashboard toolbar to enter edit mode</li>
          <li>Drag widgets by their header to reposition them</li>
          <li>Use resize handles on widget edges to change dimensions</li>
          <li>The grid reflows automatically as you rearrange</li>
          <li>Click <strong>Save Layout</strong> to keep your changes</li>
        </ol>
      </DocsSection>

      <DocsSection title="Dashboard templates">
        <p>Templates let you save multiple dashboard configurations:</p>
        <ul>
          <li><strong>Save as template</strong> - Name and save the current widget arrangement</li>
          <li><strong>Switch templates</strong> - Load any saved template from the template selector</li>
          <li><strong>Default template</strong> - The layout shown when you first open the dashboard</li>
          <li><strong>Reset</strong> - Return to the default layout if you've made changes</li>
        </ul>
      </DocsSection>

      <DocsSection title="Responsive behavior">
        <p>Widget layouts adapt across four breakpoints:</p>
        <ul>
          <li><strong>Wide desktop (1200px+)</strong> - Full grid with all widgets visible</li>
          <li><strong>Desktop (992px-1199px)</strong> - Slightly compressed layout</li>
          <li><strong>Tablet (768px-991px)</strong> - Single or two-column layout</li>
          <li><strong>Mobile (&lt;768px)</strong> - Single column stacking</li>
        </ul>
        <p>Widgets that don't fit at smaller sizes are hidden rather than compressed.</p>
      </DocsSection>
    </DocsPage>
  )
}
