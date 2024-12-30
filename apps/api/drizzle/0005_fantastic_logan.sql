CREATE INDEX "embedding_idx" ON "page_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_page_url_per_site" ON "pages" USING btree ("site_id","url");--> statement-breakpoint
CREATE INDEX "site_id_idx" ON "pages" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "page_chunks_idx" ON "pages" USING btree ("id");
