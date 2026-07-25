import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const baseDirectory = path.dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory })

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', '.claude/worktrees/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default config
