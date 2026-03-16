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
  resource_uri?: string;
  created_time?: string;
}

// Matches your actual Webflow "Videos" collection fields
export interface WebflowVideoFields {
  name: string;            // Title (PlainText, required)
  slug: string;            // Slug (PlainText, required)
  video: string;           // Video link (Link, required) — Vimeo URL e.g. https://vimeo.com/123456
  description?: string;    // Description (PlainText)
  thumbnail?: { url: string; alt?: string }; // Thumbnail (Image, required)
  duration?: string;       // Duration (PlainText) — formatted "M:SS" or "H:MM:SS"
  category?: string;       // Category (Reference to Categories collection)
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
