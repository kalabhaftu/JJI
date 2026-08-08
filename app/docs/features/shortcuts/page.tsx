import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function ShortcutsDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Keyboard Shortcuts"
      description="The command palette is the fastest way to navigate and trigger actions in the dashboard."
    >
      <DocsSection title="Command palette">
        <p>Press <strong>Ctrl/Cmd + K</strong> to open the command palette. From there you can:</p>
        <ul>
          <li>Search and navigate to any dashboard page</li>
          <li>Trigger actions like "Add New Trade" or "Import Data"</li>
          <li>Quick-access recently visited pages</li>
          <li>Run shell commands</li>
        </ul>
      </DocsSection>

      <DocsSection title="Other shortcuts">
        <ul>
          <li><strong>Escape</strong> - Close dialogs, sheets, popovers, and modals</li>
          <li><strong>Enter</strong> - Confirm current action in dialog</li>
          <li><strong>Arrow keys</strong> - Navigate within tables and lists</li>
        </ul>
      </DocsSection>

      <DocsSection title="Modal behavior">
        <p>All dialogs, sheets, and popovers are keyboard accessible. Focus is managed automatically - when a modal opens, focus moves to the first interactive element. Escape always closes the active modal.</p>
      </DocsSection>
    </DocsPage>
  )
}
