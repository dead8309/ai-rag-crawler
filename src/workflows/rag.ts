import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { pageChunks, pages, sites } from "../db/schema";
import { eq } from "drizzle-orm";
import { ScraperOptions, scrapeSite } from "../scrape";
import { AI_MODELS } from "../constants";
import { Bindings } from "../types";

export type RagWorflowParams = {
  url: string;
  strict: boolean;
  type: "browser" | "fetch";
};

export class RagWorkflow extends WorkflowEntrypoint<
  Bindings,
  RagWorflowParams
> {
  async run(event: WorkflowEvent<RagWorflowParams>, step: WorkflowStep) {
    // NOTE: Had to use pool and transactions as workers free plan only supports 50 subrequests per requests
    const pool = new Pool({ connectionString: this.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    await db.transaction(async (trx) => {
      const existingSite = await step.do("Check if site exists", async () => {
        return await trx
          .select({ id: sites.id })
          .from(sites)
          .where(eq(sites.url, event.payload.url))
          .limit(1);
      });

      const siteId = existingSite[0]?.id
        ? existingSite[0].id
        : await step.do("Insert a new site", async () => {
            const newSite = await trx
              .insert(sites)
              .values({
                url: event.payload.url,
              })
              .returning({ siteId: sites.id });

            return newSite[0].siteId;
          });

      const scrapingConfig = {
        maxNumberOfPagesToScrape: this.env.MAX_NO_OF_PAGES_TO_SCRAPE,
        baseURL: event.payload.url,
        maxConcurrency: 5,
        maxDepth: 3,
        strict: event.payload.strict,
        type: event.payload.type,
      } as ScraperOptions;

      const results = await step.do("Scrape site", async () => {
        return await scrapeSite(step, scrapingConfig);
      });

      const newPages = await step.do(
        "Insert scraped pages",
        async () =>
          await Promise.all(
            results.map(async (result) => {
              const pageId = await trx
                .insert(pages)
                .values({
                  siteId: siteId,
                  url: result.url,
                  title: result.title,
                })
                .returning({
                  pageId: pages.id,
                  title: pages.title,
                });

              return {
                pageId: pageId[0].pageId,
                title: pageId[0].title,
                text: result.cleanedText,
              };
            })
          )
      );

      await step.do("Generate vector embeddings for each page", async () => {
        await Promise.all(
          newPages.map(async (page) => {
            await step.do(
              `Generate and Insert embedding for page ${page.pageId}`,
              async () => {
                const { data } = await this.env.AI.run(AI_MODELS.embeddings, {
                  text: [page.title, page.text],
                });
                await trx
                  .update(pages)
                  .set({ embedding: data[0] })
                  .where(eq(pages.id, page.pageId));
              }
            );
          })
        );
      });
    });
  }
}
