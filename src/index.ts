import { instrument } from "@fiberplane/hono-otel";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pages, sites } from "./db/schema";
import * as schema from "./db/schema";
import { count, eq } from "drizzle-orm";

import { askRouter } from "./routes/ask";
import { workflowRouter } from "./routes/workflow";
import { cors } from "hono/cors";

import { RagWorkflow } from "./workflows/rag";
import { Bindings } from "./types";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import {
  ErrorResponseSchema,
  PageSchema,
  SingleSiteSchema,
  SiteSchema,
} from "./schema";

const getAllSitesRoute = createRoute({
  method: "get",
  path: "/api/sites",
  description: "Gets all sites",
  responses: {
    200: {
      description: "Returns a success response",
      content: {
        "application/json": {
          schema: z.array(SiteSchema),
        },
      },
    },
  },
});

const getSiteRoute = createRoute({
  method: "get",
  path: "/api/sites/{id}",
  description: "Gets a site",
  request: {
    params: z.object({
      id: z.coerce.number().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      description: "Returns a success response",
      content: {
        "application/json": {
          schema: SingleSiteSchema,
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

const deleteSitesRoute = createRoute({
  method: "delete",
  path: "/api/sites/{id}",
  description: "Deletes a site",
  request: {
    params: z.object({
      id: z.coerce.number().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      description: "Returns a success response",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }).openapi("SuccessResponse"),
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

const getPagesRoute = createRoute({
  method: "get",
  path: "/api/pages/{pageId}",
  request: {
    params: z.object({
      pageId: z.coerce.number().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      description: "Returns a success response",
      content: {
        "application/json": {
          schema: PageSchema,
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

const deletePagesRoute = createRoute({
  method: "delete",
  path: "/api/pages/{pageId}",
  description: "Deletes a page",
  request: {
    params: z.object({
      pageId: z.coerce.number().openapi({ example: 1 }),
    }),
  },
  responses: {
    200: {
      description: "Returns a success response",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }).openapi("SuccessResponse"),
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

const app = new OpenAPIHono<{ Bindings: Bindings }>()
  .route("/api/scrape", workflowRouter)
  .route("/api/sites/ask", askRouter)
  .openapi(getAllSitesRoute, async (c) => {
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

    return c.json(rows, 200);
  })

  .openapi(getSiteRoute, async (c) => {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const { id: siteId } = c.req.valid("param");

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

      return c.json(
        {
          ...sitePages,
          pages: pageRows,
        },
        200
      );
    } catch (error) {
      console.error("Error fetching pages", error);
      return c.json({ message: "An error occured" }, 500);
    }
  })
  .openapi(deleteSitesRoute, async (c) => {
    try {
      const sql = neon(c.env.DATABASE_URL);
      const db = drizzle(sql);
      const { id: siteId } = c.req.valid("param");
      await db.delete(sites).where(eq(sites.id, siteId));
      return c.json({ message: "Site deleted" });
    } catch (error) {
      console.log("Error deleting site", error);
      return c.json({ message: "An error occured" }, 500);
    }
  })
  .openapi(getPagesRoute, async (c) => {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql, { schema: schema });
    const { pageId } = c.req.valid("param");

    try {
      const pageRow = await db.query.pages.findFirst({
        with: {
          pageChunks: {
            columns: {
              id: true,
              pageId: true,
              content: true,
              chunkIndex: true,
              embedding: true,
            },
          },
        },
        where: eq(pages.id, pageId),
        columns: {
          createdAt: false,
          updatedAt: false,
        },
      });

      if (!pageRow) {
        return c.json({ message: "No page found" }, 404);
      }
      return c.json(pageRow, 200);
    } catch (error) {
      console.error("Error fetching pages", error);
      return c.json({ message: "An error occured" }, 500);
    }
  })

  .openapi(deletePagesRoute, async (c) => {
    const sql = neon(c.env.DATABASE_URL);
    const db = drizzle(sql);
    const { pageId } = c.req.valid("param");

    try {
      await db.delete(pages).where(eq(pages.id, pageId));
      return c.json({ message: "Page deleted" }, 200);
    } catch (error) {
      console.error("Error Deleting page", error);
      return c.json({ message: "An error occured" }, 500);
    }
  })

  .get("/", (c) => {
    return c.redirect("https://github.com/dead8309/ai-rag-crawler");
  })

  .use(
    "/api/*",
    cors({
      origin: "*",
      maxAge: 600,
      credentials: true,
    })
  );

export type AppType = typeof app;

export { RagWorkflow };
export default instrument(app);
