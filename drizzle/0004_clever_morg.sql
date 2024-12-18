CREATE TABLE IF NOT EXISTS "page_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embeddings" RENAME TO "pages";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "embeddings_url_unique";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "embeddings_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_chunks" ADD CONSTRAINT "page_chunks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN IF EXISTS "cleaned_text";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN IF EXISTS "embedding";