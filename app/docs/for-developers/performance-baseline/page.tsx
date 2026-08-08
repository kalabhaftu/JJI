import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function PerformanceBaselineDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Performance Baseline"
      description="Performance targets for the JJI platform."
    >
      <DocsSection title="Key metrics">
        <ul>
          <li><strong>Dashboard load:</strong> Initial KPI data should render within 2 seconds under normal conditions</li>
          <li><strong>Filter changes:</strong> Widget updates should complete within 1 second after filter change</li>
          <li><strong>Trade table:</strong> Paginated loads should complete within 500ms</li>
          <li><strong>Import parsing:</strong> Files under 10MB should parse within 5 seconds</li>
          <li><strong>Report generation:</strong> Standard reports should generate within 3 seconds</li>
        </ul>
      </DocsSection>

      <DocsSection title="Optimization strategies">
        <ul>
          <li>Use React Server Components where possible to minimize client JavaScript</li>
          <li>Cache aggregation results with configurable TTL</li>
          <li>Virtualize long lists (trades, notifications)</li>
          <li>Lazy-load below-the-fold dashboard widgets</li>
          <li>Optimize images with proper sizing and formats</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
