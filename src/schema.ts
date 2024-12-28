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
