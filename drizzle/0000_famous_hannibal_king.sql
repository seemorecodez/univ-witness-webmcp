CREATE TABLE `deployment_evidence` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`evidence_digest` text NOT NULL,
	`manifest_id` text NOT NULL,
	`program_digest` text NOT NULL,
	`invocation_source` text NOT NULL,
	`verdict` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`stored_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_evidence_evidence_digest_unique` ON `deployment_evidence` (`evidence_digest`);