import { instrument } from "@fiberplane/hono-otel";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pageChunks, pages, sites } from "./db/schema";
import {
  and,
  cosineDistance,
  count,
  desc,
  eq,
  gt,
  sql as rawSql,
} from "drizzle-orm";
import {
  AI_MODELS,
  SYSTEM_PROMPT,
} from "./constants";

import { cors } from "hono/cors";

import { RagWorkflow } from "./workflows/rag";
import { HTML } from "./html";
import { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  // return c.text("Honc! 🪿");
  return c.html(HTML);
});

app.use(
    "/api/*",
    cors({
        origin: ["http://localhost:3001"],
        maxAge: 600,
        credentials: true,
    })
);

app.get("/api/sites", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const rows = await db
    .select({
      id: sites.id,
      url: sites.url,
      totalPages: count(pages.id),
      createdAt: sites.createdAt,
      updatedAt: sites.updatedAt,
    })
    .from(sites)
    .leftJoin(pages, eq(sites.id, pages.siteId))
    .groupBy(sites.id, sites.url, sites.createdAt, sites.updatedAt);

  return c.json(rows);
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

app.get("/api/sites/:siteId", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const siteId = Number.parseInt(c.req.param("siteId"));

  if (isNaN(siteId)) {
    return c.json({ message: "Invalid siteId" }, 400);
  }
  try {
    const [sitePages] = await db
      .select({
        siteId: sites.id,
        siteUrl: sites.url,
        totalPages: count(pages.id),
      })
      .from(sites)
      .where(eq(sites.id, siteId))
      .leftJoin(pages, eq(sites.id, pages.siteId))
      .groupBy(sites.id);

    const pageRows = await db
      .select({
        id: pages.id,
        title: pages.title,
        url: pages.url,
      })
      .from(pages)
      .where(eq(pages.siteId, siteId));

    return c.json({
      ...sitePages,
      pages: pageRows,
    });
  } catch (error) {
    console.error("Error fetching pages", error);
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
      .leftJoin(pageChunks, eq(pages.id, pageChunks.pageId));

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

app.post("/api/scrape/workflow", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql);
  const { url, strict = "false", type = "browser" } = await c.req.json();
  if (!url) {
    return c.json({ message: "URL is required" }, 400);
  }
  try {
    const existingSite = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.url, url))
      .limit(1);

    if (existingSite.length > 0) {
      return c.json({ message: "Site with this URL already exists" }, 401);
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

app.get("/api/scrape/workflow/:id", async (c) => {
  const id = c.req.param("id");
  try {
    let instance = await c.env.RAG_WORKFLOW.get(id);
    return c.json({
      id: instance.id,
      ...(await instance.status()),
    });
  } catch (e: any) {
    const msg = `failed to get instance ${id}: ${e.message}`;
    console.error(msg);
    return c.json({ error: msg }, { status: 400 });
  }
});

// app.post("/api/pages/generate-embeddings", async (c) => {
//   const sql = neon(c.env.DATABASE_URL);
//   const db = drizzle(sql);
//   const { pageId } = await c.req.json();
//   if (!pageId) {
//     return c.json({ message: "Page ID is required" }, 400);
//   }
//   try {
//     const rows = await db
//       .select({
//         title: pages.title,
//         text: pageChunks.content,
//         chunkId: pageChunks.id,
//       })
//       .from(pages)
//       .where(eq(pages.id, pageId))
//       .leftJoin(pageChunks, eq(pages.id, page_chunks.pageId));
//
//     if (rows.length === 0) {
//       return c.json({ message: "Page not found" }, 404);
//     }
//
//     for (const row of rows) {
//       if (row.chunkId === null) {
//         continue;
//       }
//
//       // @ts-ignore
//       const { data } = await c.env.AI.run(AI_MODELS.embeddings, {
//         text: [row.title, row.text],
//       });
//       const values = data[0];
//       if (!values) {
//         return c.json({ message: "Embeddings not generated" }, 500);
//       }
//       await db
//         .update(pageChunks)
//         .set({
//           embedding: values,
//         })
//         .where(eq(pageChunks.id, row.chunkId));
//     }
//
//     return c.json({ message: "Embeddings generated" });
//   } catch (error) {
//     return c.json({ "An Error Occured": error }, 500);
//   }
// });

// NOTE: Can't do this as its not yet implemented by cloudflare themselves
// {
//  "error": "failed to get instance 25121daa-b71e-4b42-bfd3-240d4e3adc15: Not implemented yet"
// }
//
// app.get("/api/scrape/workflow/:id/retry", async (c) => {
//   const id = c.req.param("id");
//   try {
//     let instance = await c.env.RAG_WORKFLOW.get(id);
//     const status = await instance.status();
//     if (status.status !== "errored") {
//       return c.json({ message: "Workflow is not in errored state" }, 400);
//     }
//     await instance.restart();
//     return c.json({
//       id: instance.id,
//       ...(await instance.status()),
//     });
//   } catch (e: any) {
//     const msg = `failed to get instance ${id}: ${e.message}`;
//     console.error(msg);
//     return c.json({ error: msg }, { status: 400 });
//   }
// });

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
            .map((docs) => `${docs.url}\n\n${docs.title}\n\n${docs.content}\n`)
            .join("\n")}`
        : "";
    console.log(context);

    const { response } = (await c.env.AI.run(AI_MODELS.text_generation, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT + context },
        { role: "user", content: question },
      ],
    })) as { response: string };

    return c.json({ response });
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

app.post("/api/sites/ask/stream", async (c) => {
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
      pageChunks.embedding,
      questionEmbedding
    )})`;

    const relevantContext = await db
      .select({
        title: pages.title,
        url: pages.url,
        content: pageChunks.content,
        similarity,
      })
      .from(pageChunks)
      .innerJoin(pages, eq(pageChunks.pageId, pages.id))
      .innerJoin(sites, eq(pages.siteId, siteId))
      .where(and(eq(sites.id, siteId), gt(similarity, 0.5)))
      .orderBy((t) => desc(t.similarity))
      .limit(10);

    const context =
      relevantContext.length > 0
        ? SYSTEM_PROMPT.replace(
            "{context}",
            relevantContext
              .map(
                (docs) => `${docs.url}\n\n${docs.title}\n\n${docs.content}\n`
              )
              .join("=".repeat(20) + "\n")
          )
        : "";
    console.log(context);

    const workersai = createWorkersAI({ binding: c.env.AI });
    const result = await generateText({
      model: workersai(AI_MODELS.text_generation),
      messages: [
        { role: "system", content: context },
        { role: "user", content: question },
      ],
    });

    const references = relevantContext.map((docs) =>
      docs.url.endsWith("/") ? docs.url : docs.url + "/"
    );
    const uniqueReferences = [...new Set(references)];

    return c.json(
      { response: { answer: result.text, references: uniqueReferences } },
      200
    );
  } catch (error) {
    return c.json({ "An Error Occured": error }, 500);
  }
});

export { RagWorkflow };
export default {
  fetch: instrument(app).fetch,
};

export async function getRelevantContext({
  db,
  question,
  Ai,
  siteId,
}: {
  siteId: number;
  db: ReturnType<typeof drizzle>;
  question: string;
  Ai: Ai;
}) {
  const embedding = await Ai.run(AI_MODELS.embeddings, {
    text: [question],
  });
  const questionEmbedding = embedding.data[0];

  const similarity = rawSql<number>`1 - (${cosineDistance(
    pageChunks.embedding,
    questionEmbedding
  )})`;

  const relevantContext = await db
    .select({
      title: pages.title,
      url: pages.url,
      content: pageChunks.content,
      similarity,
    })
    .from(pageChunks)
    .innerJoin(pages, eq(pageChunks.pageId, pages.id))
    .innerJoin(sites, eq(pages.siteId, siteId))
    .where(and(eq(sites.id, siteId), gt(similarity, 0.5)))
    .orderBy((t) => desc(t.similarity))
    .limit(10);

  const context =
    relevantContext.length > 0
      ? `Context:\n${relevantContext
          .map((docs) => `${docs.url}\n\n${docs.title}\n\n${docs.content}\n`)
          .join("\n")}`
      : "";

  return context;
}
