DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "total_pages";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "links";