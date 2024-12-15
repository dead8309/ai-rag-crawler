import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  vector,
} from "drizzle-orm/pg-core";

export type NewSites = typeof sites.$inferInsert;
export type NewPages = typeof pages.$inferInsert;

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  totalPages: integer("total_pages").notNull().default(0),
  _rawLinks: text("links").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pages = pgTable("embeddings", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .references(() => sites.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  cleanedText: text("cleaned_text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
