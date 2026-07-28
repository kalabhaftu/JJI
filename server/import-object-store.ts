import { getSupabaseAdminClient } from '@/server/supabase-admin'

export const IMPORT_OBJECT_BUCKET = 'import-archives'

function buildImportObjectPath(internalUserId: string, jobId: string) {
  return `${internalUserId}/${jobId}.bin`
}

export async function uploadImportObject(params: {
  internalUserId: string
  jobId: string
  data: Buffer
  contentType: string
}) {
  const path = buildImportObjectPath(params.internalUserId, params.jobId)
  const { error } = await getSupabaseAdminClient().storage.from(IMPORT_OBJECT_BUCKET).upload(path, params.data, {
    contentType: params.contentType,
    upsert: false,
  })

  if (error) throw new Error(`Failed to store import payload: ${error.message}`)
  return path
}

export async function downloadImportObject(path: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(IMPORT_OBJECT_BUCKET).download(path)
  if (error || !data) throw new Error(`Failed to load import payload: ${error?.message ?? 'object missing'}`)
  return Buffer.from(await data.arrayBuffer())
}
