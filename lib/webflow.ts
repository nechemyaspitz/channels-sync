import { WebflowItem, WebflowCollectionItem, WebflowVideoFields } from "./types";
import { RateLimiter } from "./rate-limiter";

const WEBFLOW_BASE = "https://api.webflow.com/v2";
const rateLimiter = new RateLimiter(50); // 50 req/min to stay under 60/min limit

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function getVideosCollectionId(): string {
  return process.env.WEBFLOW_VIDEOS_COLLECTION_ID!;
}

function getSiteId(): string {
  return process.env.WEBFLOW_SITE_ID!;
}

async function webflowFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T; response: Response }> {
  await rateLimiter.throttle();

  const url = `${WEBFLOW_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options?.headers || {}) },
  });

  await rateLimiter.handleResponse(res);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Webflow API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { data: data as T, response: res };
}

/**
 * Extract the Vimeo video ID from a Vimeo URL.
 * e.g. "https://vimeo.com/123456" → "123456"
 */
export function extractVimeoIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch all items from the videos collection.
 * Builds a map of vimeo video ID → webflow item.
 * Extracts the Vimeo ID from the `video` link field URL.
 */
export async function fetchAllVideoItems(): Promise<Map<string, WebflowItem>> {
  const map = new Map<string, WebflowItem>();
  const collectionId = getVideosCollectionId();
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data } = await webflowFetch<{ items: WebflowItem[]; total: number }>(
      `/collections/${collectionId}/items?offset=${offset}&limit=${limit}`
    );

    for (const item of data.items) {
      const videoUrl = item.fieldData.video;
      const vimeoId = videoUrl ? extractVimeoIdFromUrl(String(videoUrl)) : null;
      if (vimeoId) {
        map.set(vimeoId, item);
      }
    }

    offset += data.items.length;
    if (offset >= data.total || data.items.length === 0) break;
  }

  return map;
}

/**
 * Find a Webflow item by its vimeo-video-id field.
 */
export async function findItemByVimeoId(
  vimeoId: string
): Promise<WebflowItem | null> {
  const allItems = await fetchAllVideoItems();
  return allItems.get(vimeoId) || null;
}

/**
 * Create a new video item in the collection.
 */
export async function createVideoItem(
  fields: WebflowVideoFields
): Promise<WebflowItem> {
  const collectionId = getVideosCollectionId();
  const { data } = await webflowFetch<{ items: WebflowItem[] }>(
    `/collections/${collectionId}/items/live`,
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ fieldData: fields, isDraft: false }],
      }),
    }
  );
  return data.items[0];
}

/**
 * Update an existing video item (live).
 */
export async function updateVideoItem(
  itemId: string,
  fields: Partial<WebflowVideoFields>
): Promise<WebflowItem> {
  const collectionId = getVideosCollectionId();
  const { data } = await webflowFetch<WebflowItem>(
    `/collections/${collectionId}/items/${itemId}/live`,
    {
      method: "PATCH",
      body: JSON.stringify({ fieldData: fields }),
    }
  );
  return data;
}

/**
 * Delete a video item.
 */
export async function deleteVideoItem(itemId: string): Promise<void> {
  const collectionId = getVideosCollectionId();
  await webflowFetch(`/collections/${collectionId}/items/${itemId}`, {
    method: "DELETE",
  });
}

/**
 * Publish items to make them live.
 * Accepts an array of item IDs (max 100 per call).
 */
export async function publishItems(itemIds: string[]): Promise<void> {
  const collectionId = getVideosCollectionId();

  // Batch in groups of 100
  for (let i = 0; i < itemIds.length; i += 100) {
    const batch = itemIds.slice(i, i + 100);
    await webflowFetch(
      `/collections/${collectionId}/items/publish`,
      {
        method: "POST",
        body: JSON.stringify({ itemIds: batch }),
      }
    );
  }
}

/**
 * Publish the entire site to make staged changes live.
 */
export async function publishSite(): Promise<void> {
  await webflowFetch(`/sites/${getSiteId()}/publish`, {
    method: "POST",
    body: JSON.stringify({ publishToWebflowSubdomain: true }),
  });
}

/**
 * Fetch all items from the categories collection.
 */
export async function fetchAllCategories(): Promise<WebflowCollectionItem[]> {
  const collectionId = process.env.WEBFLOW_CATEGORIES_COLLECTION_ID!;
  const items: WebflowCollectionItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data } = await webflowFetch<{
      items: WebflowCollectionItem[];
      total: number;
    }>(`/collections/${collectionId}/items?offset=${offset}&limit=${limit}`);

    items.push(...data.items);
    offset += data.items.length;
    if (offset >= data.total || data.items.length === 0) break;
  }

  return items;
}

/**
 * Generate a URL-safe slug from a name and vimeo ID.
 * Handles non-Latin characters (Hebrew/Yiddish) by falling back to just the vimeo ID.
 */
export function generateSlug(name: string, vimeoId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // If the name is entirely non-Latin (e.g. Hebrew), base will be empty
  if (base) {
    return `${base.slice(0, 90)}-${vimeoId}`;
  }
  return `video-${vimeoId}`;
}
