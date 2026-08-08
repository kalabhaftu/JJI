'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND, UNDO_COMMAND, REDO_COMMAND, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical'
import { $isHeadingNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { mergeRegister } from '@lexical/utils'

import { HugeiconsIcon } from '@hugeicons/react'
import { UndoIcon, RedoIcon, Heading01Icon, Heading02Icon, Heading03Icon, TextBoldIcon, TextItalicIcon, TextUnderlineIcon, TextStrikethroughIcon, LeftToRightListBulletIcon, LeftToRightListNumberIcon, CheckListIcon, QuotesIcon, TextAlignLeftIcon, TextAlignCenterIcon, TextAlignRightIcon, TextAlignJustifyCenterIcon } from '@hugeicons/core-free-icons'
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
        <HugeiconsIcon icon={UndoIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
      <Button aria-label="Redo" title="Redo" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} type="button">
        <HugeiconsIcon icon={RedoIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      <Toggle aria-label="Heading 1" title="Heading 1" size="sm" pressed={blockType === 'h1'} onPressedChange={() => formatHeading('h1')}>
        <HugeiconsIcon icon={Heading01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Heading 2" title="Heading 2" size="sm" pressed={blockType === 'h2'} onPressedChange={() => formatHeading('h2')}>
        <HugeiconsIcon icon={Heading02Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Heading 3" title="Heading 3" size="sm" pressed={blockType === 'h3'} onPressedChange={() => formatHeading('h3')}>
        <HugeiconsIcon icon={Heading03Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Toggle aria-label="Bold" title="Bold" size="sm" pressed={isBold} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
        <HugeiconsIcon icon={TextBoldIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Italic" title="Italic" size="sm" pressed={isItalic} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
        <HugeiconsIcon icon={TextItalicIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Underline" title="Underline" size="sm" pressed={isUnderline} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>
        <HugeiconsIcon icon={TextUnderlineIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Strikethrough" title="Strikethrough" size="sm" pressed={isStrikethrough} onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}>
        <HugeiconsIcon icon={TextStrikethroughIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Toggle aria-label="Bulleted list" title="Bulleted list" size="sm" pressed={blockType === 'ul'} onPressedChange={() => formatList('ul')}>
        <HugeiconsIcon icon={LeftToRightListBulletIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Numbered list" title="Numbered list" size="sm" pressed={blockType === 'ol'} onPressedChange={() => formatList('ol')}>
        <HugeiconsIcon icon={LeftToRightListNumberIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Checklist" title="Checklist" size="sm" pressed={blockType === 'check'} onPressedChange={() => formatList('check')}>
        <HugeiconsIcon icon={CheckListIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>
      <Toggle aria-label="Quote" title="Quote" size="sm" pressed={blockType === 'quote'} onPressedChange={() => formatQuote()}>
        <HugeiconsIcon icon={QuotesIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Toggle>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button aria-label="Align left" title="Align left" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')} type="button">
        <HugeiconsIcon icon={TextAlignLeftIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
      <Button aria-label="Align center" title="Align center" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')} type="button">
        <HugeiconsIcon icon={TextAlignCenterIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
      <Button aria-label="Align right" title="Align right" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')} type="button">
        <HugeiconsIcon icon={TextAlignRightIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
      <Button aria-label="Justify" title="Justify" variant="tertiary" size="icon" className="h-8 w-8" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')} type="button">
        <HugeiconsIcon icon={TextAlignJustifyCenterIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      </Button>
    </div>
  )
}
