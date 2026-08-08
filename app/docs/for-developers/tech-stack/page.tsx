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
          <li><strong>Framework:</strong> Next.js 15.5.21 with App Router</li>
          <li><strong>Language:</strong> TypeScript 5</li>
          <li><strong>Styling:</strong> Tailwind CSS 4 with PostCSS and shadcn/ui primitives backed by Radix UI</li>
          <li><strong>Animations:</strong> Framer Motion</li>
          <li><strong>Charts:</strong> Recharts and lightweight-charts by TradingView</li>
          <li><strong>Rich Text:</strong> Lexical editor framework</li>
          <li><strong>Forms:</strong> react-hook-form + Zod validation</li>
          <li><strong>Drag &amp; Drop:</strong> react-grid-layout</li>
          <li><strong>Tables:</strong> @tanstack/react-table</li>
          <li><strong>Client Data:</strong> TanStack Query for server state, Zustand for local state</li>
          <li><strong>Icons:</strong> Hugeicons</li>
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
          <li><strong>ORM &amp; Migrations:</strong> Drizzle ORM + drizzle-kit</li>
          <li><strong>Background Jobs:</strong> Inngest background queueing (async import processing, anchor resets, storage cleanup, breach checks)</li>
          <li><strong>Authentication:</strong> Supabase Auth (magic link, OAuth)</li>
          <li><strong>Caching &amp; Rate Limiting:</strong> Upstash Redis + @upstash/ratelimit</li>
          <li><strong>AI Engine:</strong> Vercel AI SDK (@ai-sdk/openai), xAI Grok (grok-4-1-fast-reasoning), OpenAI</li>
          <li><strong>Payments:</strong> NOWPayments (crypto) with automated reconciliation cron</li>
          <li><strong>Error Tracking:</strong> Sentry (@sentry/nextjs)</li>
          <li><strong>Deployment:</strong> Vercel with GitHub Actions CI</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
