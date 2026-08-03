'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface LexicalRendererProps {
  value?: string | null
  className?: string
}

type LexicalNode = {
  type?: string
  text?: string
  format?: number | string
  children?: LexicalNode[]
  tag?: string
  url?: string
}

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 1 << 1
const FORMAT_STRIKETHROUGH = 1 << 2
const FORMAT_UNDERLINE = 1 << 3
const FORMAT_CODE = 1 << 4

function applyTextFormatting(text: string, format: number | string | undefined) {
  if (!format || typeof format !== 'number') return text

  let content: React.ReactNode = text

  if (format & FORMAT_CODE) {
    content = <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]">{content}</code>
  }
  if (format & FORMAT_UNDERLINE) {
    content = <span className="underline">{content}</span>
  }
  if (format & FORMAT_STRIKETHROUGH) {
    content = <span className="line-through">{content}</span>
  }
  if (format & FORMAT_ITALIC) {
    content = <em>{content}</em>
  }
  if (format & FORMAT_BOLD) {
    content = <strong>{content}</strong>
  }

  return content
}

function renderChildren(children: LexicalNode[] | undefined, keyPrefix: string): React.ReactNode[] {
  if (!Array.isArray(children)) return []
  return children.map((node, index) => renderNode(node, `${keyPrefix}-${index}`)).filter(Boolean) as React.ReactNode[]
}

function renderNode(node: LexicalNode | null | undefined, key: string): React.ReactNode {
  if (!node) return null

  if (node.type === 'linebreak') {
    return <br key={key} />
  }

  if (typeof node.text === 'string') {
    return <React.Fragment key={key}>{applyTextFormatting(node.text, node.format)}</React.Fragment>
  }

  const children = renderChildren(node.children, key)

  switch (node.type) {
    case 'heading': {
      const Tag = (node.tag || 'h3') as 'h1' | 'h2' | 'h3'
      const headingClass =
        Tag === 'h1'
          ? 'text-xl font-semibold tracking-tight'
          : Tag === 'h2'
            ? 'text-lg font-semibold tracking-tight'
            : 'text-base font-semibold tracking-tight'
      return <Tag key={key} className={headingClass}>{children}</Tag>
    }
    case 'paragraph':
      return <p key={key} className="leading-7 text-sm text-foreground">{children.length > 0 ? children : <span>&nbsp;</span>}</p>
    case 'quote':
      return <blockquote key={key} className="border-l-2 border-border pl-4 text-sm italic text-muted-foreground">{children}</blockquote>
    case 'list':
      return node.tag === 'ol'
        ? <ol key={key} className="list-decimal space-y-1 pl-5 text-sm">{children}</ol>
        : <ul key={key} className="list-disc space-y-1 pl-5 text-sm">{children}</ul>
    case 'listitem':
      return <li key={key} className="leading-7">{children}</li>
    case 'link':
      return (
        <a
          key={key}
          href={node.url || '#'}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {children}
        </a>
      )
    default:
      return children.length > 0 ? <React.Fragment key={key}>{children}</React.Fragment> : null
  }
}

function normalizeLexicalValue(value?: string | null): LexicalNode[] | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (parsed?.root && Array.isArray(parsed.root.children)) {
      return parsed.root.children as LexicalNode[]
    }
  } catch {

    return null
  }

  return null
}

export function LexicalRenderer({ value, className }: LexicalRendererProps) {
  const nodes = normalizeLexicalValue(value)

  if (!nodes) {
    return (
      <div className={cn('whitespace-pre-wrap text-sm leading-7 text-foreground', className)}>
        {value || ''}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4 text-foreground', className)}>
      {nodes.map((node, index) => renderNode(node, `lexical-${index}`))}
    </div>
  )
}
