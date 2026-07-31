import logger from '@/lib/logger';
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

const apps = getApps()

if (!apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined

    if (process.env.FIREBASE_CLIENT_EMAIL && privateKey && process.env.FIREBASE_PROJECT_ID) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      })
    } else {
      logger.warn({ event: 'system_warn' }, 'Firebase admin credentials not found in environment variables.')
    }
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'Firebase admin initialization error:')
  }
}

export const messaging = getApps().length ? getMessaging() : null
