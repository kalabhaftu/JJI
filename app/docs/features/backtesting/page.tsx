import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function BacktestingDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Backtesting"
      description="Backtesting lets you log, review, and compare simulated trades separately from your live trading. Test strategies before risking real capital."
    >
      <DocsSection title="Backtesting vs live trading">
        <p>Backtesting entries are stored in a separate model from live trades. This keeps your live performance analytics clean while still letting you evaluate strategy ideas.</p>
      </DocsSection>

      <DocsSection title="Creating a backtest session">
        <ol>
          <li>Open <strong>Backtesting</strong> from the sidebar</li>
          <li>Click <strong>New Session</strong> and give it a name (e.g., "EMA Crossover April")</li>
          <li>Select the strategy or setup you're testing</li>
          <li>Add individual backtest trades with entry, exit, notes, and screenshots</li>
          <li>Classify outcomes as setup-followed or rule-break</li>
          <li>Save the session</li>
        </ol>
      </DocsSection>

      <DocsSection title="Reviewing backtest results">
        <p>Each backtest session shows aggregate metrics:</p>
        <ul>
          <li>Total P&amp;L</li>
          <li>Win rate</li>
          <li>Number of trades</li>
          <li>Average R/R</li>
          <li>Profit factor</li>
          <li>Setup compliance rate</li>
        </ul>
        <p>Compare sessions to see which strategies perform best.</p>
      </DocsSection>

      <DocsSection title="Bridge to playbook">
        <p>After a successful backtest session, formalise the strategy in your playbook. Create a setup with the exact rules you tested, then tag live trades against it to see if the results hold in production.</p>
      </DocsSection>
    </DocsPage>
  )
}
