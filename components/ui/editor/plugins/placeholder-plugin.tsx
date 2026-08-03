import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, $nodesOfType, $isElementNode, TextNode, ElementNode } from 'lexical';
import { useEffect } from 'react';
import { $isPlaceholderNode, PlaceholderNode } from '../nodes/placeholder-node';

export function PlaceholderPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([PlaceholderNode])) {
      throw new Error('PlaceholderPlugin: PlaceholderNode not registered on editor');
    }


    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const placeholders = $nodesOfType(PlaceholderNode);
        for (const node of placeholders) {
          const parent = node.getParent();
          if (!parent) continue;

          const children = parent.getChildren();
          let hasMeaningfulContent = false;

          for (const child of children) {
            if ($isTextNode(child) && !$isPlaceholderNode(child)) {
              const text = child.getTextContent();
              

              const isFirstChild = child === children[0];
              const isLabel = isFirstChild && text.match(/^[^:]+:\s$/);
              
              if (!isLabel && text.length > 0) {
                hasMeaningfulContent = true;
                break;
              }
              

              if (isLabel && text.match(/:\s\s+$/)) {
                hasMeaningfulContent = true;
                break;
              }
            }
          }

          if (hasMeaningfulContent) {
            editor.update(() => {
              if (node.isAttached()) {
                node.remove();
              }
            });
          }
        }
      });
    });
  }, [editor]);

  useEffect(() => {

    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {

          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const anchor = selection.anchor;
            const node = anchor.getNode();
            

            let parent: TextNode | ElementNode | null = node;
            while (parent && !$isElementNode(parent)) {
              parent = parent.getParent();
            }
            
            if (parent) {
              const placeholder = parent.getChildren().find($isPlaceholderNode);
              if (placeholder) {
                editor.update(() => {
                  placeholder.remove();
                });
              }
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}
