export interface Site {
  id: number;
  url: string;
  totalPages: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: number;
  title: string;
  url: string;
}

export interface SiteDetails extends Site {
  siteUrl: string;
  pages: Page[];
}

export interface WorkflowStatus {
  id: string;
  status:
    | "queued"
    | "running"
    | "paused"
    | "errored"
    | "terminated"
    | "complete"
    | "waiting"
    | "waitingForPause"
    | "unknown";
  error?: string;
  output?: object;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
