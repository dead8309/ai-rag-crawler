import { RagWorflowParams } from "./workflows/rag";

export type Bindings = {
  DATABASE_URL: string;
  MAX_NO_OF_PAGES_TO_SCRAPE: number;
  AI: Ai;
  RAG_WORKFLOW: Workflow<RagWorflowParams>;
};

export type Links = {
  url: string;
  text: string;
  hostname: string;
  pathname: string;
};

export type SiteData = {
  cleanedText: string;
  title: string;
};

export type ProxyScraperResponse = {
  total: number;
  links: Links[];
  data: SiteData;
};
