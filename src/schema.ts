import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("ErrorResponse");

export const AskMessagesSchema = z
  .object({
    siteId: z.number().openapi({ example: 1 }),
    messages: z.array(
      z.object({
        role: z
          .enum(["system", "user", "assistant", "data"])
          .openapi({ example: "system" }),
        content: z.string().openapi({ example: "Hello" }),
      })
    ),
  })
  .openapi("Messages");

export const SiteSchema = z
  .object({
    siteId: z.number(),
    siteUrl: z.string(),
    totalPages: z.number(),
    pages: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        url: z.string(),
      })
    ),
  })
  .openapi("Site");

export const PageSchema = z.object({
  page: z
    .object({
      id: z.number(),
      siteId: z.number(),
      title: z.string(),
      url: z.string().url(),
      metadata: z.any(),
    })
    .openapi("Page"),
  page_chunks: z
    .object({
      id: z.number(),
      pageId: z.number(),
      content: z.string(),
      chunkIndex: z.number(),
      embedding: z.array(z.number()),
    })
    .optional()
    .openapi("PageChunk"),
});
