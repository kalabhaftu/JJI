'use client'

import React from 'react'
import logger from '@/lib/logger'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { AutoLinkNode, LinkNode } from '@lexical/link'

import { LexicalToolbar } from './lexical-toolbar'
import { PlaceholderNode } from './nodes/placeholder-node'
import { PlaceholderPlugin } from './plugins/placeholder-plugin'

const theme = {
  paragraph: 'mb-4',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded-md font-mono text-sm',
  },
  heading: {
    h1: 'text-2xl font-bold mb-4',
    h2: 'text-xl font-bold mb-3',
    h3: 'text-lg font-bold mb-2',
  },
  list: {
    ul: 'list-disc ml-6 mb-4',
    ol: 'list-decimal ml-6 mb-4',
    listitem: 'mb-1',
    listitemChecked: 'line-through text-muted-foreground',
    listitemUnchecked: '',
  },
  quote: 'border-l-4 border-muted-foreground pl-4 italic mb-4 text-muted-foreground bg-muted/30 py-2 pr-2 rounded-r-md',
  link: 'text-primary underline cursor-pointer',
}

interface LexicalEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  minHeight?: string
}

function createEmptyParagraphNode() {
  return {
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: '',
        type: 'text',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function createEmptyEditorState() {
  return {
    root: {
      children: [createEmptyParagraphNode()],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

function sanitizeLexicalState(state: any) {
  if (!state || typeof state !== 'object') {
    return createEmptyEditorState()
  }

  const root = state.root && typeof state.root === 'object' ? state.root : null
  const children = Array.isArray(root?.children) ? [...root.children] : []

  return {
    ...state,
    root: {
      ...(root || {}),
      direction: root?.direction || 'ltr',
      format: root?.format || '',
      indent: typeof root?.indent === 'number' ? root.indent : 0,
      type: 'root',
      version: typeof root?.version === 'number' ? root.version : 1,
      // Lexical throws error #38 when root is empty.
      children: children.length > 0 ? children : [createEmptyParagraphNode()],
    },
  }
}

function toLexicalStateString(value?: string): string {
  if (!value || value.trim() === '') {
    return JSON.stringify(createEmptyEditorState())
  }

  try {
    const parsed = JSON.parse(value)
    return JSON.stringify(sanitizeLexicalState(parsed))
  } catch {
    // Migrate legacy plain text notes to a safe Lexical paragraph state.
    return JSON.stringify({
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: value,
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    })
  }
}

function SyncExternalValuePlugin({ value }: { value?: string }) {
  const [editor] = useLexicalComposerContext()

  React.useEffect(() => {
    const normalizedValue = toLexicalStateString(value)
    const currentValue = JSON.stringify(editor.getEditorState().toJSON())
    if (currentValue === normalizedValue) return

    try {
      const parsedState = editor.parseEditorState(normalizedValue)
      editor.setEditorState(parsedState)
    } catch (error) {
      // Ignore malformed payloads and keep current state.
    }
  }, [editor, value])

  return null
}

export function LexicalEditor({
  value,
  onChange,
  placeholder = 'Enter notes...',
  minHeight = '150px'
}: LexicalEditorProps) {
  const initialEditorState = toLexicalStateString(value)

  const initialConfig = {
    namespace: 'JJIEditor',
    theme,
    editorState: initialEditorState,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      PlaceholderNode
    ],
    onError: (error: Error) => {
      logger.error({ err: error }, 'Lexical Editor Error')
    },
  }

  const handleChange = (editorState: any) => {
    editorState.read(() => {
      if (onChange) {
        onChange(JSON.stringify(editorState.toJSON()))
      }
    })
  }

  return (
    <div className="border rounded-md shadow-sm relative focus-within:ring-1 focus-within:ring-ring focus-within:border-ring bg-background overflow-hidden flex flex-col">
      <LexicalComposer initialConfig={initialConfig}>
        <LexicalToolbar />
        <div className="relative flex-1">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="outline-none p-4 min-h-[150px] relative" 
                style={{ minHeight }}
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none select-none italic text-sm">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary as any}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <SyncExternalValuePlugin {...(value !== undefined && { value })} />
          <PlaceholderPlugin />
          <OnChangePlugin onChange={handleChange} />
        </div>
      </LexicalComposer>
    </div>
  )
}
