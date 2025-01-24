import { AppType } from "@repo/api";
import { hc } from "hono/client";

if (!process.env.NEXT_PUBLIC_SERVER_URL) {
  console.error("NEXT_PUBLIC_SERVER_URL is not defined");
}

export const client = hc<AppType>(process.env.NEXT_PUBLIC_SERVER_URL || "");
