import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Supabase connection string from env
// Use the "Transaction" pooler URL from Supabase dashboard (port 6543) for serverless
const connectionString = process.env.DATABASE_URL!

// Disable prefetch as it's not compatible with Supabase connection pooler
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
