/**
 * Named client-side intervals and spacers.
 * Kept in one place so the values are auditable and reusable.
 */

/** Spacer between trade-import job process calls (trade import client). */
export const IMPORT_JOB_PROCESS_SPACER_MS = 350

/** Spacer between system-restore job process calls (data import dialog). */
export const RESTORE_JOB_PROCESS_SPACER_MS = 400

/** Delay before refreshing data after a completed system restore. */
export const RESTORE_REFRESH_DELAY_MS = 1000

/** Interval for the bounded subscription-confirmation status poll. */
export const SUBSCRIPTION_CONFIRMATION_POLL_MS = 5000
