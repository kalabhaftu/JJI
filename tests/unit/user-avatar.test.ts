import { describe, expect, it } from 'vitest'

import { getUserAvatarUrl, getUserDisplayName } from '@/lib/user-avatar'

describe('user avatar helpers', () => {
  it('uses the Google profile picture from Supabase user metadata', () => {
    expect(getUserAvatarUrl({
      user_metadata: {
        picture: ' https://lh3.googleusercontent.com/a/avatar=s96-c ',
      },
    })).toBe('https://lh3.googleusercontent.com/a/avatar=s96-c')
  })

  it('uses Google identity data when the session user has no direct avatar metadata', () => {
    expect(getUserAvatarUrl({
      identities: [
        {
          provider: 'google',
          identity_data: {
            picture: 'https://lh3.googleusercontent.com/a/identity=s96-c',
          },
        },
      ],
    })).toBe('https://lh3.googleusercontent.com/a/identity=s96-c')
  })

  it('uses provider identity data from linked OAuth profiles', () => {
    expect(getUserAvatarUrl({
      identities: [
        {
          provider: 'google',
          provider_identity_data: {
            avatar_url: 'https://lh3.googleusercontent.com/a/provider=s96-c',
          },
        },
      ],
    })).toBe('https://lh3.googleusercontent.com/a/provider=s96-c')
  })

  it('keeps Google display names from OAuth metadata', () => {
    expect(getUserDisplayName({
      user_metadata: {
        full_name: 'Marshall Mathers',
      },
    })).toBe('Marshall Mathers')
  })
})
