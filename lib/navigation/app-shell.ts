export const APP_SHELL_PREFIXES = [
  '/dashboard',
  '/demo',
  '/login',
  '/reports/shared',
] as const

export function isAppShellPath(pathname: string): boolean {
  return APP_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
