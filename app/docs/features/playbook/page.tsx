import { BookCopy, ListChecks, Tags, Target } from 'lucide-react'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function PlaybookDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Playbook & Models"
      description="The playbook is your structured library of trading setups, models, and rules. Connect trade history to repeatable strategies so you can measure what actually works."
    >
      <DocsSection title="What the playbook does">
        <p>The playbook lets you define:</p>
        <ul>
          <li><strong>Setups</strong> - Named trading setups with defined entry criteria, targets, and risk rules</li>
          <li><strong>Models</strong> - Strategy templates that group multiple setups</li>
          <li><strong>Rules</strong> - Specific conditions for entry, target, confirmation, confluence, and exit</li>
          <li><strong>Tags</strong> - Label system that connects playbook entries to trade records</li>
        </ul>
      </DocsSection>

      <DocsSection title="Creating a setup">
        <ol>
          <li>Open <strong>Playbook</strong> from the sidebar</li>
          <li>Click <strong>New Setup</strong></li>
          <li>Name the setup (e.g., "Morning Breakout", "Trend Continuation")</li>
          <li>Define entry rules: what conditions must be met</li>
          <li>Define target rules: where to take profit</li>
          <li>Define risk rules: stop loss placement and position sizing</li>
          <li>Add confluence factors that strengthen the setup</li>
          <li>Save the setup</li>
        </ol>
      </DocsSection>

      <DocsSection title="Using setups in trade review">
        <p>When reviewing trades in the trade table or journal, you can assign a setup and model to each trade. This lets you:</p>
        <ul>
          <li>Filter trades by setup to see which strategies perform best</li>
          <li>Compare win rates and P&amp;L across different setups</li>
          <li>Identify which setups need refinement or retirement</li>
          <li>Track execution quality - did you follow the rules?</li>
        </ul>
      </DocsSection>

      <DocsSection title="Review workflow">
        <p>The strongest playbook workflow: backtest an idea → formalise it as a setup → trade it live with tagging → review performance in reports → refine the setup rules.</p>
      </DocsSection>
    </DocsPage>
  )
}
