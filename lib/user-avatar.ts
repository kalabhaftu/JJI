type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null
}

function readString(record: UnknownRecord | null, key: string): string | undefined {
  const value = record?.[key]
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readNestedString(record: UnknownRecord | null, path: string[]): string | undefined {
  let current: unknown = record
  for (const key of path) {
    const currentRecord = asRecord(current)
    if (!currentRecord) return undefined
    current = currentRecord[key]
  }

  return typeof current === 'string' && current.trim().length > 0 ? current.trim() : undefined
}

function firstImageCandidate(record: UnknownRecord | null): string | undefined {
  return (
    readString(record, 'avatar_url') ??
    readString(record, 'avatarUrl') ??
    readString(record, 'picture') ??
    readString(record, 'image') ??
    readString(record, 'image_url') ??
    readString(record, 'photo_url') ??
    readString(record, 'photoURL') ??
    readNestedString(record, ['data', 'avatar_url']) ??
    readNestedString(record, ['data', 'picture']) ??
    readNestedString(record, ['metadata', 'avatar_url']) ??
    readNestedString(record, ['metadata', 'picture'])
  )
}

export function getUserAvatarUrl(...users: unknown[]): string | undefined {
  for (const user of users) {
    const root = asRecord(user)
    const metadata = asRecord(root?.user_metadata)
    const appMetadata = asRecord(root?.app_metadata)

    const directCandidates = [
      firstImageCandidate(root),
      firstImageCandidate(metadata),
      firstImageCandidate(appMetadata),
    ]

    for (const candidate of directCandidates) {
      if (candidate) return candidate
    }

    const identities = Array.isArray(root?.identities) ? root.identities : []
    for (const identity of identities) {
      const identityRecord = asRecord(identity)
      const identityData = asRecord(identityRecord?.identity_data)
      const providerIdentityData = asRecord(identityRecord?.provider_identity_data)
      const candidate = firstImageCandidate(identityData) ?? firstImageCandidate(providerIdentityData)

      if (candidate) return candidate
    }
  }

  return undefined
}

export function getUserDisplayName(user: unknown): string | undefined {
  const root = asRecord(user)
  const metadata = asRecord(root?.user_metadata)
  const appMetadata = asRecord(root?.app_metadata)

  return (
    readString(root, 'full_name') ??
    readString(root, 'name') ??
    readString(metadata, 'full_name') ??
    readString(metadata, 'name') ??
    readString(metadata, 'user_name') ??
    readString(metadata, 'preferred_username') ??
    readString(appMetadata, 'full_name') ??
    readString(appMetadata, 'name')
  )
}
