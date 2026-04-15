ALTER TABLE "accounts" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "openai_auth_source" text DEFAULT 'gateway' NOT NULL;