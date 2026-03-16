import { SyncLogEntry } from "./types";
import { getMapping } from "./mapping";
import {
  fetchVideo,
  getBestThumbnail,
  formatDuration,
  getEmbedUrl,
  findVideoShowcases,
} from "./vimeo";
import {
  findItemByVimeoId,
  createVideoItem,
  updateVideoItem,
  deleteVideoItem,
  publishItems,
  generateSlug,
} from "./webflow";

interface WebhookResult {
  success: boolean;
  action: string;
  log: SyncLogEntry[];
}

/**
 * Handle a Vimeo webhook event.
 */
export async function handleWebhookEvent(
  event: string,
  resourceUri: string
): Promise<WebhookResult> {
  const log: SyncLogEntry[] = [];

  // Extract video ID from the resource URI
  const videoIdMatch = resourceUri.match(/\/videos\/(\d+)/);
  if (!videoIdMatch) {
    return {
      success: false,
      action: "unknown",
      log: [
        {
          timestamp: new Date().toISOString(),
          action: "error",
          vimeoId: "",
          videoName: "",
          details: `Could not extract video ID from URI: ${resourceUri}`,
        },
      ],
    };
  }

  const vimeoId = videoIdMatch[1];
  const mapping = getMapping();

  switch (event) {
    case "video.upload":
    case "video.added_to_showcase": {
      return handleVideoAddOrUpdate(vimeoId, mapping, log);
    }

    case "video.update": {
      return handleVideoUpdate(vimeoId, mapping, log);
    }

    case "video.delete": {
      return handleVideoDelete(vimeoId, log);
    }

    case "video.removed_from_showcase": {
      return handleVideoRemovedFromShowcase(vimeoId, resourceUri, mapping, log);
    }

    default: {
      log.push({
        timestamp: new Date().toISOString(),
        action: "skip",
        vimeoId,
        videoName: "",
        details: `Unhandled event type: ${event}`,
      });
      return { success: true, action: "skip", log };
    }
  }
}

async function handleVideoAddOrUpdate(
  vimeoId: string,
  mapping: ReturnType<typeof getMapping>,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  try {
    const video = await fetchVideo(vimeoId);

    // Find which mapped showcases this video belongs to
    const showcaseIds = await findVideoShowcases(vimeoId);
    const mappedShowcase = showcaseIds.find((id) => mapping[id]);

    if (!mappedShowcase) {
      log.push({
        timestamp: new Date().toISOString(),
        action: "skip",
        vimeoId,
        videoName: video.name,
        details: "Video not in any mapped showcase",
      });
      return { success: true, action: "skip", log };
    }

    const categoryId = mapping[mappedShowcase].webflowCategoryId;
    const existing = await findItemByVimeoId(vimeoId);

    if (existing) {
      // Update existing item
      const result = await updateVideoItem(existing.id, {
        name: video.name,
        slug: generateSlug(video.name, vimeoId),
        "vimeo-video-id": vimeoId,
        description: video.description || "",
        "duration-seconds": video.duration,
        "duration-display": formatDuration(video.duration),
        "embed-url": getEmbedUrl(video),
        thumbnail: { url: getBestThumbnail(video), alt: video.name },
        "vimeo-url": video.link,
        tags: video.tags?.map((t) => t.name).join(", ") || "",
        category: categoryId,
      });
      await publishItems([result.id]);

      log.push({
        timestamp: new Date().toISOString(),
        action: "update",
        vimeoId,
        videoName: video.name,
        details: `Updated and published`,
      });
      return { success: true, action: "update", log };
    } else {
      // Create new item
      const result = await createVideoItem({
        name: video.name,
        slug: generateSlug(video.name, vimeoId),
        "vimeo-video-id": vimeoId,
        description: video.description || "",
        "duration-seconds": video.duration,
        "duration-display": formatDuration(video.duration),
        "embed-url": getEmbedUrl(video),
        thumbnail: { url: getBestThumbnail(video), alt: video.name },
        "vimeo-url": video.link,
        tags: video.tags?.map((t) => t.name).join(", ") || "",
        category: categoryId,
      });
      await publishItems([result.id]);

      log.push({
        timestamp: new Date().toISOString(),
        action: "create",
        vimeoId,
        videoName: video.name,
        details: `Created and published in category "${mapping[mappedShowcase].categoryName}"`,
      });
      return { success: true, action: "create", log };
    }
  } catch (err) {
    log.push({
      timestamp: new Date().toISOString(),
      action: "error",
      vimeoId,
      videoName: "",
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { success: false, action: "error", log };
  }
}

async function handleVideoUpdate(
  vimeoId: string,
  mapping: ReturnType<typeof getMapping>,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  // Same as add — fetch fresh data and upsert
  return handleVideoAddOrUpdate(vimeoId, mapping, log);
}

async function handleVideoDelete(
  vimeoId: string,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  try {
    const existing = await findItemByVimeoId(vimeoId);
    if (existing) {
      await deleteVideoItem(existing.id);
      log.push({
        timestamp: new Date().toISOString(),
        action: "delete",
        vimeoId,
        videoName: String(existing.fieldData.name || ""),
        details: "Deleted from Webflow",
      });
      return { success: true, action: "delete", log };
    } else {
      log.push({
        timestamp: new Date().toISOString(),
        action: "skip",
        vimeoId,
        videoName: "",
        details: "Video not found in Webflow, nothing to delete",
      });
      return { success: true, action: "skip", log };
    }
  } catch (err) {
    log.push({
      timestamp: new Date().toISOString(),
      action: "error",
      vimeoId,
      videoName: "",
      details: `Delete error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { success: false, action: "error", log };
  }
}

async function handleVideoRemovedFromShowcase(
  vimeoId: string,
  resourceUri: string,
  mapping: ReturnType<typeof getMapping>,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  try {
    // Check if the video still belongs to any other mapped showcase
    const showcaseIds = await findVideoShowcases(vimeoId);
    const stillMapped = showcaseIds.find((id) => mapping[id]);

    if (stillMapped) {
      // Video is still in another mapped showcase — update its category
      const video = await fetchVideo(vimeoId);
      const existing = await findItemByVimeoId(vimeoId);
      if (existing) {
        const result = await updateVideoItem(existing.id, {
          category: mapping[stillMapped].webflowCategoryId,
        });
        await publishItems([result.id]);
        log.push({
          timestamp: new Date().toISOString(),
          action: "update",
          vimeoId,
          videoName: video.name,
          details: `Moved to category "${mapping[stillMapped].categoryName}"`,
        });
      }
      return { success: true, action: "update", log };
    } else {
      // Video is no longer in any mapped showcase — delete from Webflow
      return handleVideoDelete(vimeoId, log);
    }
  } catch (err) {
    log.push({
      timestamp: new Date().toISOString(),
      action: "error",
      vimeoId,
      videoName: "",
      details: `Error handling showcase removal: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { success: false, action: "error", log };
  }
}
