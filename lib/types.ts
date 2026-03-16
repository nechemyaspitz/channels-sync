export interface ShowcaseCategoryMapping {
  [showcaseId: string]: {
    webflowCategoryId: string;
    showcaseName: string;
    categoryName: string;
  };
}

export interface VimeoVideo {
  uri: string;
  name: string;
  description: string | null;
  duration: number;
  link: string;
  player_embed_url: string;
  pictures: {
    sizes: Array<{ width: number; height: number; link: string }>;
  };
  embed: { html: string };
  tags: Array<{ name: string }>;
  created_time: string;
  modified_time: string;
}

export interface VimeoShowcase {
  uri: string;
  name: string;
  description: string | null;
  link: string;
  created_time: string;
  modified_time: string;
  metadata: {
    connections: {
      videos: { total: number; uri: string };
    };
  };
}

export interface VimeoPaginatedResponse<T> {
  total: number;
  page: number;
  per_page: number;
  paging: { next: string | null; previous: string | null };
  data: T[];
}

export interface VimeoWebhookPayload {
  event: string;
  user_id: number;
  video_id?: string;
  album_id?: string;
  // The full resource URI
  resource_uri?: string;
  // Timestamp of the event
  created_time?: string;
}

export interface WebflowVideoFields {
  name: string;
  slug: string;
  "vimeo-video-id": string;
  description?: string;
  "duration-seconds"?: number;
  "duration-display"?: string;
  "embed-url"?: string;
  thumbnail?: { url: string; alt?: string };
  "vimeo-url"?: string;
  tags?: string;
  category?: string; // reference field — Webflow category item ID
}

export interface WebflowItem {
  id: string;
  fieldData: WebflowVideoFields & Record<string, unknown>;
  isDraft?: boolean;
  isArchived?: boolean;
}

export interface WebflowCollectionItem {
  id: string;
  fieldData: Record<string, unknown>;
}

export interface SyncLogEntry {
  timestamp: string;
  action: "create" | "update" | "delete" | "skip" | "error" | "publish";
  vimeoId: string;
  videoName: string;
  details: string;
}

export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  log: SyncLogEntry[];
}
