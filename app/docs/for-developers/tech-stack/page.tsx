import { Code2, Database, Globe, Layers3, Smartphone } from 'lucide-react'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function TechStackDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Tech Stack"
      description="Technologies used across the JJI platform - web dashboard, mobile app, and backend infrastructure."
    >
      <DocsSection title="Web application">
        <ul>
          <li><strong>Framework:</strong> Next.js 16 (canary) with App Router</li>
          <li><strong>Language:</strong> TypeScript 5</li>
          <li><strong>Styling:</strong> Tailwind CSS 3, shadcn/ui components</li>
          <li><strong>Animations:</strong> Framer Motion</li>
          <li><strong>Charts:</strong> Recharts, lightweight-charts by TradingView, d3</li>
          <li><strong>Rich Text:</strong> Lexical editor by Meta</li>
          <li><strong>Forms:</strong> react-hook-form + Zod validation</li>
          <li><strong>Drag &amp; Drop:</strong> react-grid-layout, @dnd-kit</li>
          <li><strong>Tables:</strong> @tanstack/react-table with react-virtual</li>
        </ul>
      </DocsSection>

      <DocsSection title="Mobile application">
        <ul>
          <li><strong>Framework:</strong> Flutter + Dart</li>
          <li><strong>State Management:</strong> Riverpod</li>
          <li><strong>Navigation:</strong> go_router</li>
          <li><strong>Networking:</strong> Dio, supabase_flutter</li>
          <li><strong>Local Storage:</strong> Hive</li>
          <li><strong>Charts:</strong> fl_chart</li>
          <li><strong>Notifications:</strong> Firebase Cloud Messaging + flutter_local_notifications</li>
          <li><strong>Speech-to-Text:</strong> speech_to_text</li>
        </ul>
      </DocsSection>

      <DocsSection title="Backend & infrastructure">
        <ul>
          <li><strong>Database:</strong> PostgreSQL via Supabase</li>
          <li><strong>ORM:</strong> Drizzle ORM</li>
          <li><strong>Authentication:</strong> Supabase Auth (magic link, OAuth)</li>
          <li><strong>State (Client):</strong> Zustand</li>
          <li><strong>State (Server):</strong> TanStack Query</li>
          <li><strong>AI:</strong> AI SDK (Vercel), OpenAI, xAI</li>
          <li><strong>Payments:</strong> NOWPayments (crypto)</li>
          <li><strong>Error Tracking:</strong> Sentry</li>
          <li><strong>Caching and rate limits:</strong> Upstash Redis</li>
          <li><strong>Deployment:</strong> Vercel with GitHub Actions CI</li>
          <li><strong>Real-time:</strong> Supabase Realtime</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
