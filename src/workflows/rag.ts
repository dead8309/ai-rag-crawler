import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { pages, sites } from "../db/schema";
import { eq } from "drizzle-orm";
import { scrapeSite } from "../scrape";
import { AI_MODELS } from "../constants";

export type RagWorflowParams = {
  url: string;
  strict: boolean;
  type: "browser" | "fetch";
};

type Env = {
  DATABASE_URL: string;
  AI: Ai;
};

export class RagWorkflow extends WorkflowEntrypoint<Env, RagWorflowParams> {
  async run(event: WorkflowEvent<RagWorflowParams>, step: WorkflowStep) {
    const db = drizzle(neon(this.env.DATABASE_URL));
    const existingSite = await step.do("Check if site exists", async () => {
      return await db
        .select()
        .from(sites)
        .where(eq(sites.url, event.payload.url))
        .limit(1);
    });

    const siteId = existingSite[0]?.id
      ? existingSite[0].id
      : await step.do("Insert a new site", async () => {
          const newSite = await db
            .insert(sites)
            .values({
              url: event.payload.url,
            })
            .returning({ siteId: sites.id });

          return newSite[0].siteId;
        });

    const scrapingConfig = {
      db,
      baseURL: event.payload.url,
      maxConcurrency: 5,
      maxDepth: 3,
      strict: event.payload.strict,
      type: event.payload.type,
    };

    const results = await step.do("Scrape site", async () => {
      return await scrapeSite(step, scrapingConfig);
    });

    const newPages = await step.do(
      "Inasert scraped pages",
      async () =>
        await Promise.all(
          results.map(async (result) => {
            const pageId = await db
              .insert(pages)
              .values({
                siteId: siteId,
                url: result.url,
                title: result.title,
                cleanedText: result.cleanedText,
              })
              .returning({ insertId: pages.id });

            return pageId[0].insertId;
          })
        )
    );

    await step.do("Generate vector embeddings for each page", async () => {
      await Promise.all(
        newPages.map(async (pageId) => {
          const [page] = await db
            .select({
              title: pages.title,
              text: pages.cleanedText,
            })
            .from(pages)
            .where(eq(pages.id, pageId))
            .limit(1);

          const embedding = await step.do(
            `Generate embedding for page ${pageId}`,
            async () => {
              const { data } = await this.env.AI.run(AI_MODELS.embeddings, {
                text: [page.title, page.text],
              });
              return data[0];
            }
          );
          await db.update(pages).set({ embedding }).where(eq(pages.id, pageId));
        })
      );
    });

    await step.do("Update site total pages", async () => {
      await db
        .update(sites)
        .set({ totalPages: results.length })
        .where(eq(sites.id, siteId));
    });
  }
}
