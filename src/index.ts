import { instrument } from "@fiberplane/hono-otel";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Hono } from "hono";
import { users, pages, sites } from "./db/schema";
import { and, cosineDistance, desc, eq, gt, sql as rawSql } from "drizzle-orm";
import { scrapeSite } from "./scrape";
import { AI_MODELS, SYSTEM_PROMPT } from "./constants";
import { RagWorflowParams, RagWorkflow } from "./workflows/rag";

type Bindings = {
  DATABASE_URL: string;
  AI: Ai;
  RAG_WORKFLOW: Workflow<RagWorflowParams>;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Honc! 🪿");
});

// URL curd
app.get("/api/sites", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const rows = await db
    .select({
      id: sites.id,
      url: sites.url,
      totalPages: sites.totalPages,
    })
    .from(sites);

  return c.json(rows);
});

app.get("/api/sites/:siteId", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const siteId = Number.parseInt(c.req.param("siteId"));
    const siteRows = await db.select().from(sites).where(eq(sites.id, siteId));
    if (siteRows.length === 0) {
      return c.json({ message: "Site not found" }, 404);
    }
    return c.json(siteRows);
  } catch (error) {
    console.error("Error fetching site", error);
    return c.json({ message: "An error occured" }, 500);
  }
});

app.get("/api/sites/:siteId/pages", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const siteId = Number.parseInt(c.req.param("siteId"));

  if (isNaN(siteId)) {
    return c.json({ message: "Invalid siteId" }, 400);
  }
  try {
    const sitePages = await db
      .select({
        id: pages.id,
        title: pages.title,
        url: pages.url,
      })
      .from(pages)
      .where(eq(pages.siteId, siteId));
    if (sitePages.length === 0) {
      return c.json({ message: "No pages found" }, 404);
    }

    return c.json(sitePages);
  } catch (error) {
    console.error("Error fetching pages", error);
    return c.json({ message: "An error occured" }, 500);
  }
});

app.delete("/api/sites", async (c) => {
  try {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const body = await c.req.json();
    const siteId = Number.parseInt(body.siteId);
    await db.delete(sites).where(eq(sites.id, siteId));
    return c.json({ message: "Site deleted" });
  } catch (error) {
    console.log("Error deleting site", error);
    return c.json({ message: "An error occured" }, 500);
  }
});

app.get("/api/pages/:pageId", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const pageId = Number.parseInt(c.req.param("pageId"));

  if (isNaN(pageId)) {
    return c.json({ message: "Invalid pageId" }, 400);
  }
  try {
    const pageRow = await db
      .select()
      .from(pages)
      .where(eq(pages.id, pageId))
      .limit(1);
    if (pageRow.length === 0) {
      return c.json({ message: "No page found" }, 404);
    }

    return c.json(pageRow[0]);
  } catch (error) {
    console.error("Error fetching pages", error);
    return c.json({ message: "An error occured" }, 500);
  }
});

app.delete("/api/pages/:pageId", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const pageId = Number.parseInt(c.req.param("pageId"));

  if (isNaN(pageId)) {
    return c.json({ message: "Invalid pageId" }, 400);
  }
  try {
    await db.delete(pages).where(eq(pages.id, pageId));
    return c.json({ message: "Page deleted" });
  } catch (error) {
    console.error("Error Deleting page", error);
    return c.json({ message: "An error occured" }, 500);
  }
});

app.post("/api/scrape/page", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const { url, strict = "false", type = "browser" } = await c.req.json();
  if (!url) {
    return c.json({ message: "URL is required" }, 400);
  }
  try {
    const existingPage = await db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.url, url))
      .limit(1);

    if (existingPage.length > 0) {
      return c.json({ message: "Page with this URL already exists" }, 400);
    }

    const { scrapedData, siteId, totalProcessed } = await scrapeSite({
      db,
      baseURL: url,
      strict,
      type,
    });

    await db
      .update(sites)
      .set({ totalPages: totalProcessed })
      .where(eq(sites.id, siteId));

    const result = scrapedData.map((data) => {
      return { url: data.url, title: data.title };
    });

    return c.json({ siteId, result: result });
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

app.post("/api/scrape/page/workflow", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const { url, strict = "false", type = "browser" } = await c.req.json();
  if (!url) {
    return c.json({ message: "URL is required" }, 400);
  }
  try {
    const existingPage = await db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.url, url))
      .limit(1);

    if (existingPage.length > 0) {
      return c.json({ message: "Page with this URL already exists" }, 400);
    }

    let instance = await c.env.RAG_WORKFLOW.create({
      params: {
        url: url,
        strict: strict,
        type: type,
      },
    });

    return c.json({
      message: "Rag Workflow started",
      instanceId: instance.id,
      details: await instance.status(),
    });
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

app.post("/api/scrape/page/workflow/status", async (c) => {
  const { id } = await c.req.json();
  try {
    let instance = await c.env.RAG_WORKFLOW.get(id);
    return Response.json({
      id: instance.id,
      ...(await instance.status()),
    });
  } catch (e: any) {
    const msg = `failed to get instance ${id}: ${e.message}`;
    console.error(msg);
    return Response.json({ error: msg }, { status: 400 });
  }
});

app.post("/api/pages/generate-embeddings", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const { pageId } = await c.req.json();
  if (!pageId) {
    return c.json({ message: "Page ID is required" }, 400);
  }
  try {
    const page = await db
      .select({
        title: pages.title,
        text: pages.cleanedText,
      })
      .from(pages)
      .where(eq(pages.id, pageId))
      .limit(1);
    if (page.length === 0) {
      return c.json({ message: "Page not found" }, 404);
    }
    const { data } = await c.env.AI.run(AI_MODELS.embeddings, {
      text: [page[0].title, page[0].text],
    });
    const values = data[0];
    if (!values) {
      return c.json({ message: "Embeddings not generated" }, 500);
    }
    await db
      .update(pages)
      .set({
        embedding: values,
      })
      .where(eq(pages.id, pageId));

    return c.json({ message: "Embeddings generated" });
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

app.post("/api/sites/ask", async (c) => {
  const sql = neon<boolean, boolean>(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const { question, site } = await c.req.json();
  if (!site || !question) {
    return c.json({ message: "Site URL and question are required" }, 400);
  }
  try {
    const embedding = await c.env.AI.run(AI_MODELS.embeddings, {
      text: [question],
    });
    const questionEmbedding = embedding.data[0];

    const similarity = rawSql<number>`1 - (${cosineDistance(
      pages.embedding,
      questionEmbedding
    )})`;

    const relevantContext = await db
      .select({
        title: pages.title,
        url: pages.url,
        content: pages.cleanedText,
        similarity,
      })
      .from(pages)
      .innerJoin(sites, eq(pages.siteId, sites.id))
      .where(and(eq(sites.url, site), gt(similarity, 0.3)))
      .orderBy((t) => desc(t.similarity))
      .limit(5);

    const context =
      relevantContext.length > 0
        ? `Context:\n${relevantContext
            .map(
              (docs) =>
                `Title: ${docs.title}\n URL: ${docs.url}\n Content: ${docs.content}\n`
            )
            .join("\n")}`
        : "";
    console.log(context);

    const { response } = (await c.env.AI.run(AI_MODELS.text_generation, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT + context },
        // { role: "system", content: context },
        { role: "user", content: question },
      ],
    })) as { response: string };

    return c.json({ message: response });
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

// Users CRUD
app.get("/api/users", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  return c.json({
    users: await db.select().from(users),
  });
});

// TODO: Implement streaming and real-time updates
// Streaming: https://hono.dev/docs/helpers/streaming#streaming-helper
// Realtime: https://developers.cloudflare.com/durable-objects/
// https://fiberplane.com/blog/creating-websocket-server-hono-durable-objects/

export { RagWorkflow };
export default {
  fetch: instrument(app).fetch,
};
