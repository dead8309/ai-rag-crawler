import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  vector,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export type NewSites = typeof sites.$inferInsert;
export type NewPages = typeof pages.$inferInsert;

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .references(() => sites.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdUrlUnique: uniqueIndex("unique_page_url_per_site").on(
      table.siteId,
      table.url
    ),
    siteIdIdx: index("site_id_idx").on(table.siteId),
  })
);

export const pagesRelations = relations(pages, ({ many }) => ({
  pageChunks: many(pageChunks),
}));

export const pageChunks = pgTable(
  "page_chunks",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .references(() => pages.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    embeddingIdx: index("embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  })
);

export const pageChunksRelations = relations(pageChunks, ({ one }) => ({
  page: one(pages, {
    fields: [pageChunks.pageId],
    references: [pages.id],
  }),
}));
