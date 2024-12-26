import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("ErrorResponse");
