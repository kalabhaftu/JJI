import { BookCopy, ListChecks, Tags, Target } from 'lucide-react'
import { DocsPage, DocsSection, DocsCallout } from '@/components/docs/docs-page'

export default function PlaybookDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Playbook & Ghost Setups"
      description="Track the setups you missed, log trade attributes, and build a playbook of what works."
    >
      <DocsSection title="Ghost Setups (Missed Trades)">
        <p>A major part of trading is logging the trades you didn't take. Ghost Setups allow you to record these missed opportunities:</p>
        <ul>
          <li><strong>How to log:</strong> Use the Manual Trade Entry form and check the "Missed Trade (Ghost Setup)" box.</li>
          <li><strong>Tracking metrics:</strong> Ghost setups let you log entry, exit, MAE, MFE, and P&L just like a real trade.</li>
          <li><strong>Visibility:</strong> They appear in your trade table with a distinct "GHOST" badge.</li>
          <li><strong>Analytics:</strong> By default, Ghost Setups are excluded from your main dashboard P&L, but you can filter to view them and see how much you left on the table.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Tagging and Trade Types">
        <p>You can categorize your trades to build your playbook over time:</p>
        <ul>
          <li><strong>Trade Type</strong> - Define the overarching strategy (e.g., Breakout, Reversal, Trend Continuation).</li>
          <li><strong>Bias</strong> - Log your market bias at the time of entry (Long, Short, Neutral).</li>
          <li><strong>Emotional State</strong> - Track your mindset (Confident, FOMO, Revenge).</li>
          <li><strong>Comments</strong> - Provide a deep dive note into why the trade matched your playbook rules.</li>
        </ul>
      </DocsSection>

      <DocsCallout title="Workflow Tip" tone="default">
        The strongest playbook workflow: define your setups → trade them live (or log them as Ghost Setups) → review performance in the dashboard filtering by Trade Type → refine the setup rules.
      </DocsCallout>
    </DocsPage>
  )
}
