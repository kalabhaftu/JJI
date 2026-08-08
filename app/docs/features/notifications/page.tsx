import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function NotificationsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Notifications"
      description="Stay informed about prop-firm updates, import completions, weekly reviews, and account events with JJI's notification system."
    >
      <DocsSection title="Notification types">
        <p>JJI supports 30+ typed notification categories:</p>
        <ul>
          <li><strong>Prop Firm</strong> - Phase passed, failed, funded, payout approved, rule breach warnings</li>
          <li><strong>Import</strong> - Import completed, parsing issues, sync errors</li>
          <li><strong>Risk</strong> - Drawdown warnings, daily loss limit approached</li>
          <li><strong>Strategy</strong> - Backtesting results, playbook suggestions</li>
          <li><strong>Payment</strong> - Subscription renewal, payment received, payment failed</li>
          <li><strong>Access</strong> - New device sign-in, account changes</li>
          <li><strong>System</strong> - Maintenance notices, feature updates</li>
          <li><strong>Weekly Review</strong> - Weekly performance summary notification</li>
        </ul>
      </DocsSection>

      <DocsSection title="Where notifications appear">
        <ul>
          <li><strong>Web dashboard</strong> - Notification bell icon in the top navbar. Unread count badge shows outstanding notifications.</li>
          <li><strong>Mobile app</strong> - Push notifications via Firebase Cloud Messaging. Notification bell in the app header.</li>
          <li><strong>In-app notification center</strong> - Full notification history with read/unread state and action links.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Configuring notifications">
        <p>Go to <strong>Settings → Notifications</strong> to configure:</p>
        <ul>
          <li>Enable/disable notification categories</li>
          <li>Choose which notifications trigger push alerts on mobile</li>
          <li>Set quiet hours (no push notifications during specified times)</li>
          <li>Receive email for critical prop-firm breach alerts when email delivery is configured</li>
        </ul>
      </DocsSection>

      <DocsSection title="Mobile push notifications">
        <p>The mobile app uses Firebase Cloud Messaging for push notifications. To receive push notifications:</p>
        <ol>
          <li>Install the JJI mobile app</li>
          <li>Sign in with your account</li>
          <li>Allow notification permissions when prompted</li>
          <li>Configure which notification types should push in Settings → Notifications</li>
        </ol>
      </DocsSection>
    </DocsPage>
  )
}
