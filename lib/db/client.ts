import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '@/lib/db/schema'

const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const globalForDb = globalThis as unknown as {
  dbClient?: ReturnType<typeof postgres>
  dbInstance?: ReturnType<typeof drizzle<typeof schema>>
}

const client =
  globalForDb.dbClient ??
  postgres(databaseUrl, {
    max: 10,
    prepare: false
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbClient = client
}

const dbInstance =
  globalForDb.dbInstance ??
  drizzle(client, {
    schema
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbInstance = dbInstance
}

export function getDb() {
  return dbInstance
}
