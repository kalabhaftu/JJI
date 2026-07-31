import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('No db url');
const sql = postgres(databaseUrl);

async function main() {
  const events = await sql`SELECT "rawPayload" FROM "WhopWebhookEvent" WHERE "eventId" = 'msg_CyvcUPIkCLJokTIKcT7XA5RK'`;
  if (events.length > 0) {
    console.log(JSON.stringify(events[0].rawPayload, null, 2));
  } else {
    console.log("Event not found in DB");
  }
  process.exit(0);
}
main().catch(console.error);
