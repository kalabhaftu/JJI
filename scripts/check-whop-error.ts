import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('No db url');
const sql = postgres(databaseUrl);

async function main() {
  const events = await sql`SELECT "eventId", "eventType", "processingResult", "errorMessage" FROM "WhopWebhookEvent" ORDER BY "processedAt" DESC LIMIT 5`;
  console.log('Recent Webhook Events:');
  console.table(events);
  process.exit(0);
}
main().catch(console.error);
