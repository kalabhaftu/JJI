export function getDocsUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://docs.justjournalit.site'
  }
  return '/docs'
}

export function getDemoUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://demo.justjournalit.site'
  }
  return '/demo'
}
