
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

console.log('Creating mailing_list table...');

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS mailing_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_type TEXT NOT NULL,
    source TEXT DEFAULT 'subscription_plans',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    ip_hash TEXT,
    user_agent_hash TEXT,
    unsubscribe_token TEXT UNIQUE,
    unsubscribed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  )
`);

console.log('✅ Table created successfully');
process.exit(0);

