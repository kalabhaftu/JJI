'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND, UNDO_COMMAND, REDO_COMMAND, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical'
import { $isHeadingNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { mergeRegister } from '@lexical/utils'

import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, List, ListOrdered, ListTodo, Quote, Heading1, Heading2, Heading3 } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function LexicalToolbar() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [blockType, setBlockType] = useState('paragraph')

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))

      const anchorNode = selection.anchor.getNode()
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)
      
      if (elementDOM !== null) {
        if ($isHeadingNode(element)) {
          const tag = (element as any).getTag()
          setBlockType(tag)
        } else {
          const type = element.getType()
          if (type === 'list') {
            const listNode = element as any
            const listType = listNode.getListType()
            setBlockType(listType === 'number' ? 'ol' : listType === 'check' ? 'check' : 'ul')
          } else {
            setBlockType(type)
          }
        }
      }
    }
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      })
    )
  }, [editor, updateToolbar])

  const formatHeading = (headingSize: 'h1' | 'h2' | 'h3') => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize))
        }
      })
    } else {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode())
        }
      })
    }
  }

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      })
    } else {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode())
        }
      })
    }
  }

  const formatList = (type: 'ul' | 'ol' | 'check') => {
    if (blockType !== type) {
      if (type === 'ul') editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
      else if (type === 'ol') editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
      else if (type === 'check') editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/20">
      <Button aria-label="Undo" title="Undo" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} type="button">
        <Undo className="h-4 w-4" />
      </Button>
      <Button aria-label="Redo" title="Redo" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} type="button">
        <Redo className="h-4 w-4" />
      </Button>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      <Toggle aria-label="Heading 1" title="Heading 1" size="sm" pressed={blockType === 'h1'} onPressedChange={() => formatHeading('h1')}>
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Heading 2" title="Heading 2" size="sm" pressed={blockType === 'h2'} onPressedChange={() => formatHeading('h2')}>
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Heading 3" title="Heading 3" size="sm" pressed={blockType === 'h3'} onPressedChange={() => formatHeading('h3')}>
        <Heading3 className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Toggle aria-label="Bold" title="Bold" size="sm" pressed={isBold} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Italic" title="Italic" size="sm" pressed={isItalic} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Underline" title="Underline" size="sm" pressed={isUnderline} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Strikethrough" title="Strikethrough" size="sm" pressed={isStrikethrough} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Toggle aria-label="Bulleted list" title="Bulleted list" size="sm" pressed={blockType === 'ul'} onPressedChange={() => formatList('ul')}>
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Numbered list" title="Numbered list" size="sm" pressed={blockType === 'ol'} onPressedChange={() => formatList('ol')}>
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Checklist" title="Checklist" size="sm" pressed={blockType === 'check'} onPressedChange={() => formatList('check')}>
        <ListTodo className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Quote" title="Quote" size="sm" pressed={blockType === 'quote'} onPressedChange={() => formatQuote()}>
        <Quote className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button aria-label="Align left" title="Align left" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')} type="button">
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button aria-label="Align center" title="Align center" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')} type="button">
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button aria-label="Align right" title="Align right" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')} type="button">
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button aria-label="Justify" title="Justify" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')} type="button">
        <AlignJustify className="h-4 w-4" />
      </Button>
    </div>
  )
}
