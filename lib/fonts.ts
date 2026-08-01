const systemFontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const appFontStack = `"DM Sans", ${systemFontStack}`

const systemFont = {
  variable: '--font-system',
  className: 'font-sans',
  style: {
    fontFamily: appFontStack,
  },
}

const appFont = systemFont

// Backward-compatible aliases for existing layout imports.
export const satoshi = systemFont

const fontClassName = `${systemFont.variable} font-sans`
export const fontFamily = `"DM Sans", var(--font-system), ${systemFontStack}`
