const PRESERVED_SYMBOLS = new Set([
  0x2318,
  0x2192,
  0x2190,
  0x2191,
  0x2193,
  0x2713,
  0x2714,
  0x2716,
  0x2717,
  0x00a9,
  0x00ae,
  0x2122,
].map((code) => String.fromCodePoint(code)))

const COLORFUL_SYMBOL = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2300}-\u{23FF}]/gu

export function cleanContent(content: unknown): unknown {
  if (content === null || content === undefined) return content
  if (typeof content === 'string') {
    return content.replace(
      COLORFUL_SYMBOL,
      (symbol) => PRESERVED_SYMBOLS.has(symbol) ? symbol : '',
    ).trim()
  }
  if (Array.isArray(content)) return content.map(cleanContent)
  if (typeof content === 'object') {
    return Object.fromEntries(
      Object.entries(content).map(([key, value]) => [key, cleanContent(value)]),
    )
  }
  return content
}

export function formatNoteContent(content: string | null | undefined): string {
  if (!content) return ''
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return content

  try {
    const parsed = JSON.parse(trimmed) as {
      root?: { children?: Array<Record<string, unknown>> }
    }
    if (!parsed.root?.children) return content

    const extractText = (nodes: Array<Record<string, unknown>>): string => (
      nodes.map((node) => {
        if (typeof node.text === 'string') return node.text
        if (Array.isArray(node.children)) {
          const childrenText = extractText(
            node.children as Array<Record<string, unknown>>,
          )
          return ['paragraph', 'listitem', 'heading', 'quote'].includes(
            String(node.type),
          )
            ? `${childrenText}\n`
            : childrenText
        }
        return node.type === 'linebreak' ? '\n' : ''
      }).join('')
    )

    return extractText(parsed.root.children).trim()
  } catch {
    return content
  }
}
