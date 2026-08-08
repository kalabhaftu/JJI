import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function FrontendDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Frontend Guidelines"
      description="Frontend conventions for the JJI web application. These guidelines help maintain consistency across the dashboard, public pages, and shared components."
    >
      <DocsSection title="Component architecture">
        <ul>
          <li><strong>Shared UI primitives:</strong> Reusable components in <code>components/ui/</code> built on shadcn/ui</li>
          <li><strong>Feature components:</strong> Feature-specific components live in <code>app/dashboard/components/</code></li>
          <li><strong>Layout components:</strong> Shell components (sidebar, navbar, headers) in <code>components/layouts/</code></li>
          <li><strong>Server components by default:</strong> Use client components only when interactivity is required</li>
        </ul>
      </DocsSection>

      <DocsSection title="State management">
        <ul>
          <li><strong>Server state:</strong> TanStack Query for all API data fetching, caching, and mutations</li>
          <li><strong>Client state:</strong> Zustand stores for UI state (sidebar, filters, theme)</li>
          <li><strong>Form state:</strong> react-hook-form with Zod schemas</li>
          <li><strong>URL state:</strong> Search params for shareable filter states</li>
        </ul>
      </DocsSection>

      <DocsSection title="Responsive design">
        <p>The dashboard supports four breakpoints:</p>
        <ul>
          <li>Wide desktop (1200px+)</li>
          <li>Desktop (992px-1199px)</li>
          <li>Tablet (768px-991px)</li>
          <li>Mobile (&lt;768px)</li>
        </ul>
        <p>Use Tailwind breakpoint prefixes. Test all changes at each breakpoint.</p>
      </DocsSection>
    </DocsPage>
  )
}
