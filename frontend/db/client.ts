import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const sqliteDb = openDatabaseSync('fixsight_offline.db');

// Ensure database tables are created at startup
sqliteDb.execSync(`
  CREATE TABLE IF NOT EXISTS hazard_taxonomy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    category TEXT,
    description TEXT,
    icon TEXT,
    default_guidance TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    focus_target_id TEXT
  );
`);

export const db = drizzle(sqliteDb, { schema });
