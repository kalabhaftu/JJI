import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const files = execFileSync('rg', ['--files', 'app', 'components', '-g', '*.tsx'], {
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean)

const result = {
  unnamedIconControls: [],
  clickableNonControls: [],
  primitiveTouchTargetsMissing: [],
  hoverOnlyActions: [],
}

for (const file of files) {
  // Shared primitives own their event handlers by design. Audit product
  // surfaces for accidental clickable containers, not primitive internals.
  if (file.startsWith('components/ui/')) continue
  const text = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  function walk(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
      const attribute = (name) => attributes.find((item) => item.name.getText(source) === name)
      const location = source.getLineAndCharacterOfPosition(node.getStart(source))
      const reference = `${file}:${location.line + 1}`

      if (['Button', 'Toggle'].includes(tag)) {
        const size = attribute('size')
        const isIcon = size?.initializer && ts.isStringLiteral(size.initializer) && size.initializer.text === 'icon'
        if (isIcon && !attribute('aria-label') && !attribute('aria-labelledby') && !attribute('title')) {
          result.unnamedIconControls.push(reference)
        }
      }

      if (['div', 'span', 'Card', 'article'].includes(tag) && attribute('onClick')) {
        result.clickableNonControls.push(reference)
      }
    }

    ts.forEachChild(node, walk)
  }

  walk(source)
}

// Shared interactive primitives must enforce 44px touch targets on coarse
// pointers and never hide their only control behind hover alone. RevealAction
// inherits the touch minimums from the Button primitive at render time, so it
// is asserted via tests/components/reveal-action.test.tsx instead.
for (const file of ['components/ui/button.tsx', 'components/ui/removable-filter-chip.tsx']) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('[@media(pointer:coarse)]:min-h-11')) {
    result.primitiveTouchTargetsMissing.push(file)
  }
}

for (const file of ['components/ui/reveal-action.tsx', 'components/ui/removable-filter-chip.tsx']) {
  const text = readFileSync(file, 'utf8')
  if (file.endsWith('reveal-action.tsx') && !(text.includes('focus-visible:opacity-100') && text.includes('[@media(pointer:coarse)]:opacity-100'))) {
    result.hoverOnlyActions.push(`${file}: hover-gated without focus or coarse-pointer fallback`)
  }
  if (file.endsWith('removable-filter-chip.tsx') && (text.includes('group-hover:opacity-0') || text.includes('group-hover:invisible') || !text.includes('focus-visible:ring-2'))) {
    result.hoverOnlyActions.push(`${file}: removal control is hover-only or lacks visible focus`)
  }
}

process.stdout.write(JSON.stringify(result))
