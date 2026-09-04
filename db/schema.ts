import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const deploymentEvidence = sqliteTable('deployment_evidence', {
  evidenceId: text('evidence_id').primaryKey(),
  evidenceDigest: text('evidence_digest').notNull().unique(),
  manifestId: text('manifest_id').notNull(),
  programDigest: text('program_digest').notNull(),
  invocationSource: text('invocation_source').notNull(),
  verdict: text('verdict').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
  storedAt: text('stored_at').notNull(),
});
