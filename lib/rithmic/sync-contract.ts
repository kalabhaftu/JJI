export interface RithmicCredentials {
  username: string
  password: string
  server_type: string
  location: string
  userId: string
}

export function parseRithmicRateLimitMessage(detail: string) {
  const match = detail.match(
    /Maximum (\d+) attempts allowed per (\d+\.?\d*) minutes\. Please wait (\d+\.?\d*) minutes/,
  )
  return match
    ? { max: match[1], period: match[2], wait: match[3] }
    : { max: '2', period: '15', wait: '12' }
}
