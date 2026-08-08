import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function GoalsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Goals"
      description="Set trading goals and track your progress over time. Goals help you stay focused on what matters - whether it's consistency, risk management, or profitability."
    >
      <DocsSection title="Goal types">
        <p>You can set goals across several dimensions:</p>
        <ul>
          <li><strong>Daily Goals</strong> - Per-day targets (e.g., max 2% risk per day, minimum 1 trade)</li>
          <li><strong>Weekly Goals</strong> - Weekly targets (e.g., 10 trades with at least 40% win rate)</li>
          <li><strong>Monthly Goals</strong> - Monthly objectives (e.g., 5% return, max 5% drawdown)</li>
          <li><strong>Custom Goals</strong> - Define your own metric and target</li>
        </ul>
      </DocsSection>

      <DocsSection title="Setting a goal">
        <ol>
          <li>Open <strong>Goals</strong> from the dashboard sidebar</li>
          <li>Click <strong>New Goal</strong></li>
          <li>Choose the goal type (daily/weekly/monthly/custom)</li>
          <li>Select the metric: P&amp;L, win rate, trades, profit factor, drawdown, R/R, or custom</li>
          <li>Set the target value and time period</li>
          <li>Optionally add notes describing why this goal matters</li>
          <li>Save</li>
        </ol>
      </DocsSection>

      <DocsSection title="Tracking progress">
        <p>Goals are tracked automatically against your imported trade data:</p>
        <ul>
          <li>Each goal shows current progress as a percentage</li>
          <li>Visual progress bars show how close you are to each target</li>
          <li>Goals are filter-aware - they track against the same account filters as your dashboard</li>
          <li>Weekly and monthly goals reset at the configured intervals</li>
        </ul>
      </DocsSection>

      <DocsSection title="Goals in weekly review">
        <p>Your active goals are referenced in the weekly review report. The review shows which goals are on track, which need attention, and suggestions for adjustment.</p>
      </DocsSection>

      <DocsSection title="Mobile access">
        <p>Goals are viewable on the mobile app. Check your goal progress from the Dashboard tab or the More menu.</p>
      </DocsSection>
    </DocsPage>
  )
}
