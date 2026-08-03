import fs from 'fs/promises'
import path from 'path'
import readline from 'readline'

import { config as loadEnvFile } from 'dotenv'
import { createClient } from '@supabase/supabase-js'


type AuthUser = {
  id: string
  email: string | null
  created_at: string
}

type DbUser = {
  id: string
  email: string
  auth_user_id: string
}

type UserStats = {
  db: Record<string, number>
  storage: Array<{
    bucket: string
    count: number
    sizeBytes: number
  }>
}

type OrphanResult = {
  type: 'bucket' | 'folder' | 'record' | 'user'
  location: string
  id: string
  details?: string
}


function loadEnvironment() {
  loadEnvFile({ path: path.join(process.cwd(), '.env') })
  loadEnvFile({ path: path.join(process.cwd(), '.env.local'), override: true })

  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars missing')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function getPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Database URL missing')
  
  const dbUrl = new URL(url)
  dbUrl.searchParams.delete('pgbouncer')
  dbUrl.searchParams.delete('connection_limit')
  
  return new PrismaClient({
    datasources: { db: { url: dbUrl.toString() } }
  })
}

const supabase = getSupabaseAdmin()
const prisma = getPrisma()


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query: string): Promise<string> => 
  new Promise((resolve) => rl.question(query, resolve))

const clear = () => console.clear()


async function listAllAuthUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    
    users.push(...(data.users as any[]).map(u => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at
    })))
    
    if (data.users.length < perPage) break
    page++
  }
  return users
}

async function getDbUserStats(userId: string) {
  const stats: Record<string, number> = {}
  
  const tables = [
    { name: 'Account', field: 'userId' },
    { name: 'Trade', field: 'userId' },
    { name: 'BacktestTrade', field: 'userId' },
    { name: 'DailyNote', field: 'userId' },
    { name: 'MasterAccount', field: 'userId' },
    { name: 'ActivityLog', field: 'userId' },
    { name: 'ImportJob', field: 'userId' },
    { name: 'JournalTemplate', field: 'userId' }
  ]

  for (const table of tables) {
    try {
      const count = await (prisma as any)[table.name.charAt(0).toLowerCase() + table.name.slice(1)].count({
        where: { [table.field]: userId }
      })
      stats[table.name] = count
    } catch (e) {
      stats[table.name] = 0
    }
  }
  
  return stats
}

async function getStorageStats(userId: string, authId: string) {
  const { data: buckets, error: bError } = await supabase.storage.listBuckets()
  if (bError) throw bError

  const results: UserStats['storage'] = []
  
  for (const bucket of buckets) {


    const folders = ['trades', 'avatars', 'notes', 'backtests']
    let totalCount = 0
    let totalSize = 0


    if (bucket.name === userId || bucket.name === authId) {
      const { data: files } = await supabase.storage.from(bucket.name).list('', { recursive: true })
      if (files) {
        totalCount += files.length
        totalSize += files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
      }
    } else {
      for (const folder of folders) {
        const { data: files } = await supabase.storage.from(bucket.name).list(`${folder}/${userId}`, { recursive: true })
        if (files) {
          totalCount += files.length
          totalSize += files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
        }
        

        if (userId !== authId) {
            const { data: filesAuth } = await supabase.storage.from(bucket.name).list(`${folder}/${authId}`, { recursive: true })
            if (filesAuth) {
              totalCount += filesAuth.length
              totalSize += filesAuth.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
            }
        }
      }
    }

    if (totalCount > 0) {
      results.push({ bucket: bucket.name, count: totalCount, sizeBytes: totalSize })
    }
  }
  
  return results
}


async function deleteUser(user: DbUser, authUser?: AuthUser) {
  console.log(`\nDeleting user ${user.email}...`)
  

  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets) {
    for (const bucket of buckets) {

      if (bucket.name === user.id || bucket.name === user.auth_user_id) {
        console.log(`- Deleting user bucket: ${bucket.name}`)
        try {

          const { data: files } = await supabase.storage.from(bucket.name).list('', { recursive: true })
          if (files && files.length > 0) {
            await supabase.storage.from(bucket.name).remove(files.map(f => f.name))
          }
          await supabase.storage.deleteBucket(bucket.name)
        } catch (e) {
          console.error(`  Error deleting bucket: ${e instanceof Error ? e.message : String(e)}`)
        }
      } else {

        const folders = ['trades', 'avatars', 'notes', 'backtests', 'weekly-calendars']
        for (const folder of folders) {
          const prefixes = [ `${folder}/${user.id}`, `${folder}/${user.auth_user_id}` ]
          for (const prefix of prefixes) {
            const { data: files } = await supabase.storage.from(bucket.name).list(prefix, { recursive: true })
            if (files && files.length > 0) {
              console.log(`- Deleting ${files.length} objects from ${bucket.name}/${prefix}`)
              try {
                await supabase.storage.from(bucket.name).remove(files.map(f => `${prefix}/${f.name}`))
              } catch (e) {
                console.error(`  Error removing objects: ${e instanceof Error ? e.message : String(e)}`)
              }
            }
          }
        }
      }
    }
  }


  if (user.auth_user_id) {
    console.log(`- Deleting auth user: ${user.auth_user_id}`)
    const { error } = await supabase.auth.admin.deleteUser(user.auth_user_id)
    if (error) {
       if (error.message.includes('User not found')) {
         console.log(`  Auth user already gone.`)
       } else {
         console.error(`  Error deleting auth user: ${error.message}`)
       }
    }
  }


  console.log(`- Deleting DB user: ${user.id}`)
  try {

    const { count } = await prisma.user.deleteMany({ where: { id: user.id } })
    if (count === 0) console.log(`  DB user already gone.`)
  } catch (e) {
    console.error(`  Error deleting DB user: ${e instanceof Error ? e.message : String(e)}`)
  }

  console.log('User cleanup complete.')
}

async function manageBuckets() {
  clear()
  console.log('--- Bucket & Folder Management ---')
  console.log('Note: UUID-named buckets or folders should match active User IDs.\n')
  
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) { console.error(error); return }

  const authUsers = await listAllAuthUsers()
  const authIds = new Set(authUsers.map(u => u.id))
  
  const dbUsers = await prisma.user.findMany({ select: { id: true, auth_user_id: true, email: true } })
  const dbIds = new Set(dbUsers.map(u => u.id))
  const validIds = new Set([...authIds, ...dbIds])

  console.log(`${buckets.length} buckets found.\n`)
  
  let orphanedFound = 0

  for (const bucket of buckets) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bucket.name)
    let owner = 'System/Shared'
    let isOrphaned = false

    if (isUuid) {
      if (validIds.has(bucket.name)) {
        const user = dbUsers.find(u => u.id === bucket.name || u.auth_user_id === bucket.name)
        owner = user ? `User: ${user.email}` : 'Auth-only User'
      } else {
        owner = 'UNKNOWN (Orphaned Bucket)'
        isOrphaned = true
        orphanedFound++
      }
    }

    const { data: files } = await supabase.storage.from(bucket.name).list('', { limit: 1 })
    const status = isOrphaned ? ' [ORPHANED BUCKET]' : ''
    console.log(`${bucket.name.padEnd(40)} | ${owner.padEnd(30)} | ${files?.length ? 'Has files' : 'Empty'}${status}`)


    if (!isUuid) {
      const sharedFolders = ['trades', 'avatars', 'notes', 'backtests', 'weekly-calendars']
      for (const folder of sharedFolders) {
        const { data: subfolders } = await supabase.storage.from(bucket.name).list(folder)
        if (subfolders) {
          for (const sub of subfolders) {
            const isSubUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub.name)
            if (isSubUuid && !validIds.has(sub.name)) {
               console.log(`  [!] Orphaned folder in ${bucket.name}/${folder}: ${sub.name}`)
               orphanedFound++
            }
          }
        }
      }
    }
  }

  if (orphanedFound > 0) {
    console.log(`\n[!] Found ${orphanedFound} orphaned storage entities (buckets or folders).`)
    const ans = await question('Run full audit script to clean these up? (y/n): ')
    if (ans.toLowerCase() === 'y') {
       await runDatabaseAudit(true)
    }
  }

  await question('\nPress Enter to return to main menu...')
}

async function runDatabaseAudit(autoFix = false) {
  clear()
  console.log('--- Database & Storage Integrity Audit ---')
  
  let fixMode = autoFix
  if (!autoFix) {
    console.log('1. Run Audit (Dry Run)')
    console.log('2. Run Audit & Fix (DELETE Orphans)')
    console.log('3. Back')

    const choice = await question('\nChoice: ')
    if (choice === '3') return
    fixMode = choice === '2'
  }

  console.log(`\nRunning audit${fixMode ? ' (FIX MODE)' : ''}...`)


  console.log('\n[1/4] Checking for Ghost Users...')
  const authUsers = await listAllAuthUsers()
  const authUserIds = new Set(authUsers.map(u => u.id))
  const dbUsers = await prisma.user.findMany({ select: { id: true, email: true } })
  
  let ghostCount = 0
  for (const user of dbUsers) {
    if (!authUserIds.has(user.id)) {
      console.log(`[!] Ghost user: ${user.email} (${user.id})`)
      ghostCount++
      if (fixMode) {
        await prisma.user.deleteMany({ where: { id: user.id } })
        console.log(`    [✓] Deleted from DB.`)
      }
    }
  }
  if (ghostCount === 0) console.log('[✓] No ghost users found.')


  console.log('\n[2/4] Checking for Abandoned Payments (2h+)...')
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const abandoned = await prisma.paymentRecord.findMany({
    where: {
      providerStatus: { in: ['pending', 'waiting', 'confirming', 'sending'] },
      createdAt: { lt: twoHoursAgo }
    }
  })
  if (abandoned.length > 0) {
    console.log(`[!] Found ${abandoned.length} abandoned payments.`)
    if (fixMode) {
      await prisma.paymentRecord.updateMany({
        where: { id: { in: abandoned.map(p => p.id) } },
        data: { providerStatus: 'expired', expiredAt: new Date() }
      })
      console.log(`    [✓] Marked as EXPIRED.`)
    }
  } else {
    console.log('[✓] No abandoned payments found.')
  }


  console.log('\n[3/5] Checking for Orphaned Storage (Buckets/Folders)...')
  const { data: buckets } = await supabase.storage.listBuckets()
  const validIds = new Set([
    ...dbUsers.map(u => u.id),
    ...authUsers.map(u => u.id)
  ])
  
  let orphanStorageCount = 0
  if (buckets) {
    for (const bucket of buckets) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bucket.name)
      if (isUuid && !validIds.has(bucket.name)) {
        console.log(`[!] Orphaned bucket: ${bucket.name}`)
        orphanStorageCount++
        if (fixMode) {
          const { data: files } = await supabase.storage.from(bucket.name).list('', { recursive: true })
          if (files && files.length > 0) await supabase.storage.from(bucket.name).remove(files.map(f => f.name))
          await supabase.storage.deleteBucket(bucket.name)
          console.log(`    [✓] Bucket deleted.`)
        }
      } else if (!isUuid) {
        const folders = ['trades', 'avatars', 'notes', 'backtests', 'weekly-calendars']
        for (const folder of folders) {
          const { data: subfolders } = await supabase.storage.from(bucket.name).list(folder)
          if (subfolders) {
            for (const sub of subfolders) {
              const isSubUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub.name)
              if (isSubUuid && !validIds.has(sub.name)) {
                console.log(`[!] Orphaned folder in ${bucket.name}/${folder}: ${sub.name}`)
                orphanStorageCount++
                if (fixMode) {
                  const { data: files } = await supabase.storage.from(bucket.name).list(`${folder}/${sub.name}`, { recursive: true })
                  if (files && files.length > 0) {
                    await supabase.storage.from(bucket.name).remove(files.map(f => `${folder}/${sub.name}/${f.name}`))
                  }
                  console.log(`    [✓] Folder cleaned up.`)
                }
              }
            }
          }
        }
      }
    }
  }
  if (orphanStorageCount === 0) console.log('[✓] Storage structure is clean.')


  console.log('\n[4/5] Checking for Orphaned DB Records...')
  const tables = [
    'Account', 'Trade', 'TradeExecution', 'BacktestTrade', 'DailyNote', 'MasterAccount',
    'ActivityLog', 'ImportJob', 'JournalTemplate', 'Notification', 'WeeklyReview',
    'TradeTag', 'TradingModel', 'UserGeoLog', 'UserGoal', 'SharedReport',
    'DashboardTemplate', 'LiveAccountTransaction', 'WeeklyAIReview', 'Subscription',
    'PaymentRecord', 'PromoRedemption', 'Feedback', 'UserSettings'
  ]
  
  let totalOrphanRecords = 0
  for (const table of tables) {
    const orphans = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int as count 
      FROM "${table}" t
      LEFT JOIN "User" u ON t."userId" = u."id"
      WHERE t."userId" IS NOT NULL AND u."id" IS NULL
    `)
    const count = orphans[0].count
    if (count > 0) {
      console.log(`[!] ${table.padEnd(25)}: ${count} orphans.`)
      totalOrphanRecords += count
      if (fixMode) {
        await prisma.$executeRawUnsafe(`
          DELETE FROM "${table}"
          WHERE "userId" IN (
            SELECT t."userId"
            FROM "${table}" t
            LEFT JOIN "User" u ON t."userId" = u."id"
            WHERE t."userId" IS NOT NULL AND u."id" IS NULL
          )
        `)
        console.log(`    [✓] Deleted.`)
      }
    }
  }
  if (totalOrphanRecords === 0) console.log('[✓] No orphaned records found.')


  console.log('\n[5/5] Checking for Broken Storage Links (DB -> Storage)...')
  const modelsWithImages = [
    { name: 'Trade', fields: ['imageOne', 'imageTwo', 'imageThree', 'imageFour', 'imageFive', 'imageSix', 'cardPreviewImage'] },
    { name: 'BacktestTrade', fields: ['imageOne', 'imageTwo', 'imageThree', 'imageFour', 'imageFive', 'imageSix', 'cardPreviewImage'] },
    { name: 'WeeklyReview', fields: ['calendarImage'] }
  ]

  let brokenLinksCount = 0
  for (const model of modelsWithImages) {
    const records = await (prisma as any)[model.name.charAt(0).toLowerCase() + model.name.slice(1)].findMany({
      where: {
        OR: model.fields.map(field => ({ [field]: { not: null } }))
      },
      select: { id: true, userId: true, ...Object.fromEntries(model.fields.map(f => [f, true])) }
    })

    if (records.length > 0) {
      console.log(`    Scanning ${records.length} ${model.name} records...`)
    }

    for (const record of records) {
      for (const field of model.fields) {
        const url = record[field]
        if (url && typeof url === 'string' && url.includes('supabase.co/storage/v1/object/public/')) {
          try {
            const pathParts = url.split('/storage/v1/object/public/')[1].split('/')
            const bucket = pathParts[0]
            const filePath = pathParts.slice(1).join('/')


            const { data, error } = await supabase.storage.from(bucket).list(path.dirname(filePath), {
              search: path.basename(filePath)
            })

            if (error || !data || data.length === 0) {
               console.log(`[!] Broken link in ${model.name} (${record.id}) [${field}]: ${url}`)
               brokenLinksCount++
               if (fixMode) {
                 await (prisma as any)[model.name.charAt(0).toLowerCase() + model.name.slice(1)].update({
                   where: { id: record.id },
                   data: { [field]: null }
                 })
                 console.log(`    [✓] Set field to null.`)
               }
            }
          } catch (e) {

          }
        }
      }
    }
  }
  if (brokenLinksCount === 0) console.log('[✓] No broken storage links found.')

  console.log('\nAudit complete.')
  if (!autoFix) await question('\nPress Enter to return...')
}


async function userDetailsFlow(user: DbUser) {
  clear()
  console.log(`--- User Details: ${user.email} ---`)
  console.log(`DB ID:   ${user.id}`)
  console.log(`Auth ID: ${user.auth_user_id}`)
  
  console.log('\nFetching statistics...')
  const [dbStats, storageStats] = await Promise.all([
    getDbUserStats(user.id),
    getStorageStats(user.id, user.auth_user_id)
  ])

  console.log('\nDatabase Records:')
  for (const [table, count] of Object.entries(dbStats)) {
    if (count > 0) console.log(`- ${table.padEnd(20)}: ${count}`)
  }

  console.log('\nStorage Usage:')
  if (storageStats.length === 0) {
    console.log('No storage objects found.')
  } else {
    for (const s of storageStats) {
      const size = (s.sizeBytes / 1024 / 1024).toFixed(2)
      console.log(`- Bucket: ${s.bucket.padEnd(20)} | Files: ${s.count.toString().padEnd(5)} | Size: ${size} MB`)
    }
  }

  console.log('\nOptions:')
  console.log('1. Delete user (ALL DATA)')
  console.log('2. Back')
  
  const choice = await question('\nChoice: ')
  if (choice === '1') {
    const confirm = await question(`Type 'DELETE' to confirm deleting ${user.email}: `)
    if (confirm === 'DELETE') {
      await deleteUser(user)
      await question('\nUser deleted. Press Enter...')
    } else {
      console.log('Deletion cancelled.')
      await question('\nPress Enter...')
    }
  }
}

async function listUsersFlow() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, auth_user_id: true },
    orderBy: { email: 'asc' }
  })

  while (true) {
    clear()
    console.log(`--- User List (${users.length} users) ---`)
    users.forEach((u, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. ${u.email.padEnd(40)} | ${u.id}`)
    })
    console.log('\nSelect a number to view details, or "b" to go back.')
    
    const choice = await question('Choice: ')
    if (choice.toLowerCase() === 'b') break
    
    const idx = parseInt(choice) - 1
    if (users[idx]) {
      await userDetailsFlow(users[idx])

      return listUsersFlow()
    }
  }
}

async function searchUserFlow() {
  const query = await question('\nEnter email or ID to search: ')
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { id: query },
        { auth_user_id: query }
      ]
    }
  })

  if (user) {
    await userDetailsFlow(user)
  } else {
    console.log('User not found.')
    await question('\nPress Enter...')
  }
}

async function mainMenu() {
  loadEnvironment()
  
  while (true) {
    clear()
    console.log('--- JJI User Management CLI ---')
    console.log('1. List Users')
    console.log('2. Search User')
    console.log('3. Bucket Management')
    console.log('4. Database Audit & Cleanup')
    console.log('5. Exit')
    
    const choice = await question('\nChoice: ')
    
    switch (choice) {
      case '1': await listUsersFlow(); break
      case '2': await searchUserFlow(); break
      case '3': await manageBuckets(); break
      case '4': await runDatabaseAudit(); break
      case '5': 
        console.log('Goodbye!')
        await prisma.$disconnect()
        process.exit(0)
      default: break
    }
  }
}

mainMenu().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
