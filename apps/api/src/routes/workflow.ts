import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { z } from "zod";
import { sites } from "../db/schema";
import { ErrorResponseSchema } from "@repo/shared";
import { Bindings } from "../types";

const scrapeWorkflowRoute = createRoute({
  method: "post",
  path: "/workflow",
  description: "Starts a scrape workflow",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              url: z
                .string()
                .openapi({ example: "https://fiberplane.com/changelog" }),
              strict: z
                .boolean()
                .optional()
                .openapi({ example: false })
                .default(false),
              type: z
                .enum(["fetch", "browser"])
                .optional()
                .openapi({
                  description: "browser or fetch",
                  example: "fetch",
                })
                .default("fetch"),
            })
            .openapi("ScrapeWorkflowRequest"),
        },
      },
    },
  },
  responses: {
    401: {
      description: "Returns an error response",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    200: {
      description: "Returns the response from the scrape workflow",
      content: {
        "application/json": {
          schema: z
            .object({
              message: z.string(),
              instanceId: z.string(),
              details: z.any(),
            })
            .openapi("ScrapeWorkflowResponse"),
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

const getWorkflowRoute = createRoute({
  method: "get",
  path: "/workflow/{id}",
  description: "Get the status of a workflow",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "workflowId" }),
    }),
  },
  responses: {
    200: {
      description: "Returns the status of the workflow",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            status: z.custom<InstanceStatus["status"]>(),
            error: z.custom<InstanceStatus["error"]>().optional(),
            output: z.custom<InstanceStatus["output"]>().optional(),
          }),
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
  },
});

const router = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(scrapeWorkflowRoute, async (c) => {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const { url, type, strict } = c.req.valid("json");
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

      return c.json(
        {
          message: "Rag Workflow started",
          instanceId: instance.id,
          details: await instance.status(),
        },
        200
      );
    } catch (error) {
      return c.json({ "An Error Occured": error }, 500);
    }
  })
  .openapi(getWorkflowRoute, async (c) => {
    const { id } = c.req.valid("param");
    try {
      let instance = await c.env.RAG_WORKFLOW.get(id);
      return c.json(
        {
          id: instance.id,
          ...(await instance.status()),
        },
        200
      );
    } catch (e: any) {
      const msg = `failed to get instance ${id}: ${e.message}`;
      console.error(msg);
      return c.json({ message: msg }, 400);
    }
  });

// NOTE: Can't do this as its not yet implemented by cloudflare themselves as of 18/12/2024
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

export { router as workflowRouter };
