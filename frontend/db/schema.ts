import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const hazardTaxonomy = sqliteTable('hazard_taxonomy', {
  id: integer('id').primaryKey(),
  label: text('label').notNull().unique(),
  category: text('category'),
  description: text('description'),
  icon: text('icon'),
  default_guidance: text('default_guidance'), // Stored as JSON string
});

export const chatHistory = sqliteTable('chat_history', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  timestamp: integer('timestamp').notNull(),
  focusTargetId: text('focus_target_id'),
});
