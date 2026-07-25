import { Fragment } from 'react'

function InlineText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

export function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const value = line.trim()
        if (!value || ['---', '***', '___'].includes(value)) return null

        const heading = value.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          const level = heading[1]!.length
          const classes = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'
          return <h3 key={index} className={`pt-3 font-semibold tracking-tight text-foreground ${classes}`}><InlineText text={heading[2]!} /></h3>
        }

        if (/^[-*]\s/.test(value)) {
          return (
            <div key={index} className="flex items-start gap-2.5 pl-1 text-sm text-muted-foreground">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="leading-6"><InlineText text={value.slice(2)} /></span>
            </div>
          )
        }

        const ordered = value.match(/^(\d+)\.\s+(.+)$/)
        if (ordered) {
          return (
            <div key={index} className="flex items-start gap-2.5 pl-1 text-sm text-muted-foreground">
              <span className="min-w-5 pt-0.5 text-xs font-semibold text-foreground">{ordered[1]}.</span>
              <span className="leading-6"><InlineText text={ordered[2]!} /></span>
            </div>
          )
        }

        return <p key={index} className="text-sm leading-6 text-muted-foreground"><InlineText text={value} /></p>
      })}
    </div>
  )
}
