import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function BackendDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Backend Structure"
      description="The JJI backend is primarily server-side, handling data aggregation, filtering, authentication, and analytics computations."
    >
      <DocsSection title="API architecture">
        <ul>
          <li><strong>Route handlers:</strong> Next.js App Router route handlers in <code>app/api/</code></li>
          <li><strong>API versioning:</strong> v1 API under <code>app/api/v1/</code></li>
          <li><strong>Server utilities:</strong> Shared server logic in <code>server/</code> directory</li>
          <li><strong>Authentication:</strong> Next.js proxy in <code>proxy.ts</code> for auth checks</li>
        </ul>
      </DocsSection>

      <DocsSection title="Key backend responsibilities">
        <ul>
          <li>Dashboard data aggregation and SQL metric computation via Drizzle ORM</li>
          <li>Report generation, equity curve calculations, and trade analytics</li>
          <li>User-scoped data isolation enforcing strict <code>user_id</code> query scoping</li>
          <li>Trade import parsing, column mapping, and async background job queueing</li>
          <li>Prop-firm challenge phase evaluation engine and daily anchor tracking</li>
          <li>Async background job execution via <strong>Inngest</strong> (<code>/api/inngest</code> handler for <code>processImportJob</code>, <code>checkBreaches</code>, <code>resetDailyAnchors</code>, and <code>cleanupUserStorage</code>)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Security & Rate Limiting">
        <ul>
          <li>Database tenant isolation via PostgreSQL and Supabase Auth token validation</li>
          <li>Server-side identity verification in all API route handlers</li>
          <li>Distributed rate limiting powered by Upstash Redis and <code>@upstash/ratelimit</code></li>
          <li>Prompt injection pre-filtering and AI request token limits on AI routes</li>
          <li>Content Security Policy (CSP) headers and strict API CORS middleware</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
