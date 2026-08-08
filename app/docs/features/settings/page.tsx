import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function SettingsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Settings"
      description="Configure your profile, display preferences, time settings, linked accounts, AI features, and subscription."
    >
      <DocsSection title="Profile">
        <p>Manage your basic account information:</p>
        <ul>
          <li>Update first and last name</li>
          <li>View your account email (managed through your auth provider)</li>
          <li>Profile picture (if supported by auth provider)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Preferences">
        <ul>
          <li><strong>Theme</strong> - Light, Dark, or System default</li>
          <li><strong>Accent Pack</strong> - Choose from available accent color schemes</li>
          <li><strong>Timezone</strong> - Set your local timezone for trade date grouping</li>
          <li><strong>Time Format</strong> - 12-hour or 24-hour display</li>
          <li><strong>Break-even Threshold</strong> - P&amp;L threshold (in currency units) below which a trade is considered break-even</li>
          <li><strong>Starting Day of Week</strong> - Monday or Sunday as week start for reports</li>
        </ul>
      </DocsSection>

      <DocsSection title="AI preferences">
        <p>Control AI-powered features:</p>
        <ul>
          <li>Enable or disable AI review suggestions</li>
          <li>Configure which AI provider to use (OpenAI or xAI)</li>
          <li>Manage AI API keys if using a custom setup</li>
        </ul>
      </DocsSection>

      <DocsSection title="Linked accounts">
        <p>Manage authentication providers linked to your account:</p>
        <ul>
          <li>Link or unlink OAuth providers (Google, GitHub)</li>
          <li>Manage email-based authentication</li>
          <li>View connected broker sync accounts (Tradovate, Rithmic, etc.)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Notifications">
        <p>Configure which notifications you receive:</p>
        <ul>
          <li>Prop-firm phase updates (passed, failed, funded)</li>
          <li>Payout notifications</li>
          <li>Import completion alerts</li>
          <li>Weekly review reminders</li>
          <li>Push notifications for mobile app</li>
        </ul>
      </DocsSection>

      <DocsSection title="Subscription">
        <p>Your JJI subscription is managed in settings:</p>
        <ul>
          <li>View current plan and billing status</li>
          <li>Payment history (crypto via NOWPayments)</li>
          <li>Cancel subscription</li>
        </ul>
      </DocsSection>

      <DocsSection title="Account actions">
        <ul>
          <li><strong>Sign Out</strong> - End current session</li>
          <li><strong>Delete Account</strong> - Permanently delete your account and all associated data. This action is irreversible.</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
