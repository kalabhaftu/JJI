import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function AiChatDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="AI Chat & Insights"
      description="JJI includes AI-powered analysis tools that can review your trading performance, identify patterns, assess risk, and help you build better strategies."
    >
      <DocsSection title="What AI Chat can do">
        <ul>
          <li><strong>Performance Analysis</strong> - Ask questions about your trading performance, trends, and areas for improvement</li>
          <li><strong>Risk Audit</strong> - The AI can review your risk management, position sizing, and drawdown patterns</li>
          <li><strong>Strategy Expectancy</strong> - Calculate and explain the expectancy of your strategies based on historical data</li>
          <li><strong>Psychological Assessment</strong> - Identify emotional patterns in your trading (fear of missing out, revenge trading, overconfidence)</li>
          <li><strong>Trade Review</strong> - Paste a specific trade or scenario for AI analysis</li>
        </ul>
      </DocsSection>

      <DocsSection title="How to use AI Chat">
        <ol>
          <li>Open <strong>AI Chat</strong> from the dashboard sidebar</li>
          <li>A conversation panel opens on the right side of the dashboard</li>
          <li>Type your question or request in natural language</li>
          <li>The AI has context-aware access to your trading data and can reference your actual performance</li>
          <li>Continue the conversation with follow-up questions</li>
        </ol>
        <p>Example prompts:</p>
        <ul>
          <li>"What's my win rate this month and how does it compare to last month?"</li>
          <li>"Analyze my risk management - am I risking too much per trade?"</li>
          <li>"Which of my setups has the best profit factor?"</li>
          <li>"Review my trading psychology based on my recent losing streak"</li>
        </ul>
      </DocsSection>

      <DocsSection title="AI engine & providers">
        <p>JJI uses the Vercel AI SDK to interface with high-performance model providers:</p>
        <ul>
          <li><strong>OpenAI:</strong> Default reasoning model (GPT-4o) configured for analytical and risk-focused trading review.</li>
        </ul>
        <p>Requests undergo prompt injection pre-filtering, rate limiting via Upstash Redis, and server-side token budget enforcement before execution.</p>
      </DocsSection>

      <DocsSection title="Privacy and data">
        <p>Your trading data is sent to the AI provider only when you explicitly ask a question. Chat history is stored in your account and is not shared with other users. You can disable AI features entirely in settings.</p>
      </DocsSection>

      <DocsCallout title="Note" tone="success">
        AI insights are suggestions, not financial advice. Always apply your own judgment when reviewing AI-generated analysis.
      </DocsCallout>
    </DocsPage>
  )
}
