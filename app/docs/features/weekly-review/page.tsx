import { BarChart3, CalendarDays, MessageSquare, TrendingUp } from 'lucide-react'
import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function WeeklyReviewDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Weekly Review"
      description="The weekly review provides a structured summary of your trading performance for the past week, with insights and comparison to previous periods."
    >
      <DocsSection title="What the weekly review includes">
        <ul>
          <li><strong>Performance Summary</strong> - Total P&amp;L, win rate, number of trades, profit factor for the week</li>
          <li><strong>Comparison</strong> - How this week compares to the previous week and your rolling 4-week average</li>
          <li><strong>Day-by-Day Breakdown</strong> - P&amp;L and trade count for each day of the week</li>
          <li><strong>Best &amp; Worst Trades</strong> - Highlight of the best and worst performing trades</li>
          <li><strong>Setup Performance</strong> - Which setups/models performed best during the week</li>
          <li><strong>Risk Metrics</strong> - Average R/R, max drawdown, largest loser</li>
          <li><strong>Journal Prompt</strong> - Guided questions to reflect on your week</li>
        </ul>
      </DocsSection>

      <DocsSection title="Accessing the weekly review">
        <p>The weekly review is available from:</p>
        <ul>
          <li><strong>Dashboard</strong> - A weekly review widget shows a summary with a link to the full review</li>
          <li><strong>Reports</strong> - The weekly review is listed alongside other report types</li>
          <li><strong>Notifications</strong> - If enabled, you receive a notification when a new weekly review is ready</li>
        </ul>
      </DocsSection>

      <DocsSection title="Weekly review cadence">
        <p>The review period is Sunday to Saturday (configurable in settings → Starting Day of Week). The review is generated automatically after the week closes. You can also manually generate a review for any past week.</p>
      </DocsSection>

      <DocsSection title="Weekly goals">
        <p>If you have goals set (see Goals feature), the weekly review shows your progress toward weekly targets. This helps you stay accountable to your trading objectives.</p>
      </DocsSection>

      <DocsCallout title="Tip" tone="success">
        Use the journal prompt in the weekly review to build a consistent reflection habit. Even 5 minutes of weekly review can significantly improve trading discipline.
      </DocsCallout>
    </DocsPage>
  )
}
