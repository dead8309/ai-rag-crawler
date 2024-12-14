import pLimit from "p-limit";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { NeonQueryFunction } from "@neondatabase/serverless";
import { SiteData, ProxyScraperResponse } from "./types";
import { withRetries } from "./retry";
import { WorkflowStep } from "cloudflare:workers";

// const PROXY_SCRAPER_URL = "https://vercel-puppeteer-proxy.vercel.app/api";
const PROXY_SCRAPER_URL = "http://localhost:3000/api";

const DEFAULT_OPTIONS = {
  type: "browser" as const,
  strict: false as const,
  maxDepth: 3,
  maxConcurrency: 5,
};

type Database = NeonHttpDatabase<Record<string, never>> & {
  $client: NeonQueryFunction<false, false>;
};

type ScraperOptions = {
  db: Database;
  baseURL: string;
  type: "browser" | "fetch";
  strict: boolean;
  maxDepth?: number;
  maxConcurrency?: number;
};

export async function scrapeSite(
  step: WorkflowStep,
  {
    baseURL,
    type = DEFAULT_OPTIONS.type,
    strict = DEFAULT_OPTIONS.strict,
    maxDepth = DEFAULT_OPTIONS.maxDepth,
    maxConcurrency = DEFAULT_OPTIONS.maxConcurrency,
  }: ScraperOptions
) {
  const limit = pLimit(maxConcurrency);
  const queue = [{ url: baseURL, depth: 0 }];
  const processedUrls = new Set<string>();
  const allResults = [];

  while (queue.length > 0) {
    const batch = queue.splice(0, maxConcurrency);
    // NOTE: HARD LIMIT of 100 pages for now
    if (processedUrls.size >= 100) {
      break;
    }

    const results = await step.do(
      `Process Scraping for batch urls`,
      async () =>
        await Promise.all(
          batch.map(({ url, depth }) =>
            limit(async () => {
              if (processedUrls.has(url)) return null;
              processedUrls.add(url);

              try {
                const result = await fetchPageData(url, strict, type);
                if (!result) return null;

                const { data, links } = result;

                links
                  .map((link) => new URL(link.url, baseURL).href)
                  .filter(
                    (newUrl) => !processedUrls.has(newUrl) && depth < maxDepth
                  )
                  .forEach((newUrl) =>
                    queue.push({ url: newUrl, depth: depth + 1 })
                  );

                return { url, ...data };
              } catch (error) {
                console.error(`Failed to process ${url}:`, error);
                return null;
              }
            })
          )
        )
    );

    const validResults = results.filter(Boolean) as (SiteData & {
      url: string;
    })[];
    allResults.push(...validResults);
  }

  return allResults;
}

async function fetchPageData(
  url: string,
  strict: boolean = false,
  type: "browser" | "fetch" = "browser"
): Promise<ProxyScraperResponse | null | undefined> {
  return withRetries(async () => {
    const reqUrl = new URL(PROXY_SCRAPER_URL);
    reqUrl.searchParams.set("url", url);
    reqUrl.searchParams.set("strict", `${strict}`);
    reqUrl.searchParams.set("type", type);

    const response = await fetch(reqUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed for ${url}: ${response.statusText}`);
    }
    return await response.json();
  });
}
