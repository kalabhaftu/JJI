import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function JournalDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Journal & Notes"
      description="The journal connects your trade history with written review. Annotate trading days, add notes and screenshots, and review trades with full context."
    >
      <DocsSection title="Daily journaling">
        <p>Each trading day can have a journal entry. To create one:</p>
        <ol>
          <li>Open the <strong>Journal</strong> page from the sidebar</li>
          <li>Select a date from the calendar or use the date picker</li>
          <li>Write your journal entry using the rich text editor (Lexical)</li>
          <li>Add screenshots by dragging images or using the upload button</li>
          <li>Set an emotion/mood tag for the day</li>
          <li>Save the entry</li>
        </ol>
      </DocsSection>

      <DocsSection title="Trade notes">
        <p>Individual trades can carry notes and media:</p>
        <ul>
          <li>Open a trade from the <strong>Trade Table</strong></li>
          <li>Add notes in the edit panel</li>
          <li>Upload screenshots or chart images</li>
          <li>Set a featured image - the preview crop is saved so journal cards show the framing you chose</li>
          <li>Add tags for categorisation (links to the playbook system)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Calendar connection">
        <p>The calendar widget on the dashboard shows which days have journal entries. Days with entries show a visual indicator. Clicking a day opens a review modal with:</p>
        <ul>
          <li>That day's P&amp;L summary</li>
          <li>Journal text preview</li>
          <li>Featured screenshot</li>
          <li>List of trades executed that day</li>
        </ul>
      </DocsSection>

      <DocsSection title="Image management">
        <p>Images uploaded to journal entries and trades support:</p>
        <ul>
          <li>Preview cropping - drag to select the visible crop area</li>
          <li>Full-image viewing in gallery mode</li>
          <li>Delete and replace workflows</li>
          <li>Responsive sizing across devices</li>
        </ul>
      </DocsSection>

      <DocsSection title="Mobile journaling">
        <p>The mobile app supports journaling with speech-to-text input. You can dictate your daily review on the go and it syncs to your web account automatically.</p>
      </DocsSection>
    </DocsPage>
  )
}
