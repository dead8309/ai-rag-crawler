import { createOpenAI } from "@ai-sdk/openai";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { neon } from "@neondatabase/serverless";
import { generateText, streamText, tool } from "ai";
import { and, cosineDistance, desc, eq, gt, sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { stream } from "hono/streaming";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import {
  AI_MODELS,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WITHOUT_CONTEXT,
} from "../constants";
import { pageChunks, pages, sites } from "../db/schema";
import { ErrorResponseSchema, AskMessagesSchema } from "@repo/shared";
import { Bindings } from "../types";

const streamAskRoute = createRoute({
  method: "post",
  path: "/stream",
  description: "Asks a question about scraped documentation",
  request: {
    body: {
      content: {
        "application/json": {
          schema: AskMessagesSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "returns the response from AI based on the given context",
      content: {
        "text/event-stream": {
          schema: z.string(),
        },
      },
    },
    400: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const askQuestionRoute = createRoute({
  method: "post",
  path: "/",
  description: "Asks a question about scraped documentation",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              siteId: z.number().openapi({ example: 1 }),
              question: z
                .string()
                .openapi({ example: "What is your purpose?" }),
            })
            .openapi("AskRequest"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "returns the response from AI based on the given context",
      content: {
        "application/json": {
          schema: z
            .object({
              response: z.object({
                answer: z.string(),
                references: z.array(z.string()),
              }),
            })
            .openapi("AskQuestionResponse"),
        },
      },
    },
    400: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const router = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(askQuestionRoute, async (c) => {
    const sql = neon<boolean, boolean>(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const { question, siteId } = c.req.valid("json");
    const [row] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!row) {
      return c.json(
        { message: "Site not found. Make sure you are using correct link" },
        404
      );
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
  })
  .openapi(streamAskRoute, async (c) => {
    const sql = neon<boolean, boolean>(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const { messages, siteId } = c.req.valid("json");

    try {
      // const aiStream = (await c.env.AI.run(AI_MODELS.text_generation, {
      //   messages: [
      //     { role: "system", content: SYSTEM_PROMPT + context },
      //     { role: "user", content: question },
      //   ],
      //   stream: true,
      // })) as ReadableStream;

      // return new Response(aiStream, {
      //   headers: {
      //     "Content-Type": "text/event-stream",
      //   },
      // });

      const openai = createOpenAI({
        apiKey: c.env.OPENAI_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      });
      const result = streamText({
        model: openai("deepseek-chat"),
        system: SYSTEM_PROMPT_WITHOUT_CONTEXT,
        messages,
        tools: {
          getInformation: tool({
            description: "Get information from your knowledge base to answer",
            parameters: z.object({
              question: z.string().describe("User's question"),
            }),
            execute: async ({ question }) => {
              const ctx = await getRelevantContext({
                db,
                question,
                Ai: c.env.AI,
                siteId,
              });
              console.log(ctx);

              return ctx;
            },
          }),
        },
        maxSteps: 5,
      });

      c.header("X-Vercel-AI-Data-Stream", "v1");
      c.header("Content-Type", "text/plain; charset=utf-8");

      return stream(c, (stream) => stream.pipe(result.toDataStream()));
    } catch (error) {
      console.log("Error", error);
      return c.json({ "An Error Occured": error }, 500);
    }
  });

export { router as askRouter };

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

  // const context =
  //  relevantContext.length > 0
  //    ? `Context:\n${relevantContext
  //        .map((docs) => `${docs.url}\n\n${docs.title}\n\n${docs.content}\n`)
  //        .join("\n")}`
  //    : "";

  return relevantContext;
}
