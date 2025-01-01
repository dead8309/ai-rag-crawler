import { AppType } from "@repo/api";
import { hc } from "hono/client";

if (!process.env.NEXT_PUBLIC_SERVER_URL) {
  throw new Error("NEXT_PUBLIC_SERVER_URL is not defined");
}

export const client = hc<AppType>(process.env.NEXT_PUBLIC_SERVER_URL as string);
