import { SyncLogEntry } from "./types";
import { getMapping } from "./mapping";
import {
  fetchVideo,
  getBestThumbnail,
  formatDuration,
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

  console.log(`[handler] Processing event: ${event}, URI: ${resourceUri}`);

  const videoIdMatch = resourceUri.match(/\/videos\/(\d+)/);
  if (!videoIdMatch) {
    console.error(`[handler] Could not extract video ID from URI: ${resourceUri}`);
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
  console.log(`[handler] Video ID: ${vimeoId}, mapped showcases: ${Object.keys(mapping).length}`);

  switch (event) {
    // App webhook types
    case "video-created":
    case "video-transcode-complete":
    // Legacy event names
    case "video.upload":
    case "video.added_to_showcase": {
      return handleVideoAddOrUpdate(vimeoId, mapping, log);
    }

    case "video-updated":
    case "video.update": {
      return handleVideoAddOrUpdate(vimeoId, mapping, log);
    }

    case "video-deleted":
    case "video.delete": {
      return handleVideoDelete(vimeoId, log);
    }

    case "video.removed_from_showcase": {
      return handleVideoRemovedFromShowcase(vimeoId, mapping, log);
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
    console.log(`[handler:add/update] Fetching video ${vimeoId} from Vimeo`);
    const video = await fetchVideo(vimeoId);
    console.log(`[handler:add/update] Video: "${video.name}"`);

    const showcaseIds = await findVideoShowcases(vimeoId);
    console.log(`[handler:add/update] Video in showcases: [${showcaseIds.join(", ")}]`);
    const mappedShowcase = showcaseIds.find((id) => mapping[id]);

    if (!mappedShowcase) {
      console.log(`[handler:add/update] Video "${video.name}" not in any mapped showcase, skipping`);
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
    const fields = {
      name: video.name,
      slug: generateSlug(video.name, vimeoId),
      video: video.link,
      description: video.description || "",
      thumbnail: { url: getBestThumbnail(video), alt: video.name },
      duration: formatDuration(video.duration),
      category: categoryId,
    };

    const existing = await findItemByVimeoId(vimeoId);

    if (existing) {
      console.log(`[handler:add/update] Updating existing Webflow item ${existing.id} for "${video.name}"`);
      const result = await updateVideoItem(existing.id, fields);
      await publishItems([result.id]);
      console.log(`[handler:add/update] Updated and published "${video.name}"`);
      log.push({
        timestamp: new Date().toISOString(),
        action: "update",
        vimeoId,
        videoName: video.name,
        details: "Updated and published",
      });
      return { success: true, action: "update", log };
    } else {
      console.log(`[handler:add/update] Creating new Webflow item for "${video.name}" in category "${mapping[mappedShowcase].categoryName}"`);
      const result = await createVideoItem(fields);
      await publishItems([result.id]);
      console.log(`[handler:add/update] Created and published "${video.name}"`);
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
    console.error(`[handler:add/update] Error for video ${vimeoId}:`, err instanceof Error ? err.stack : String(err));
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

async function handleVideoDelete(
  vimeoId: string,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  try {
    console.log(`[handler:delete] Looking up video ${vimeoId} in Webflow`);
    const existing = await findItemByVimeoId(vimeoId);
    if (existing) {
      console.log(`[handler:delete] Deleting Webflow item ${existing.id} ("${existing.fieldData.name}")`);
      await deleteVideoItem(existing.id);
      console.log(`[handler:delete] Deleted "${existing.fieldData.name}" from Webflow`);
      log.push({
        timestamp: new Date().toISOString(),
        action: "delete",
        vimeoId,
        videoName: String(existing.fieldData.name || ""),
        details: "Deleted from Webflow",
      });
      return { success: true, action: "delete", log };
    } else {
      console.log(`[handler:delete] Video ${vimeoId} not found in Webflow, nothing to delete`);
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
    console.error(`[handler:delete] Error deleting video ${vimeoId}:`, err instanceof Error ? err.stack : String(err));
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
  mapping: ReturnType<typeof getMapping>,
  log: SyncLogEntry[]
): Promise<WebhookResult> {
  try {
    console.log(`[handler:showcase-remove] Checking if video ${vimeoId} is still in a mapped showcase`);
    const showcaseIds = await findVideoShowcases(vimeoId);
    console.log(`[handler:showcase-remove] Video still in showcases: [${showcaseIds.join(", ")}]`);
    const stillMapped = showcaseIds.find((id) => mapping[id]);

    if (stillMapped) {
      const video = await fetchVideo(vimeoId);
      const existing = await findItemByVimeoId(vimeoId);
      if (existing) {
        console.log(`[handler:showcase-remove] Moving "${video.name}" to category "${mapping[stillMapped].categoryName}"`);
        const result = await updateVideoItem(existing.id, {
          category: mapping[stillMapped].webflowCategoryId,
        });
        await publishItems([result.id]);
        console.log(`[handler:showcase-remove] Moved and published "${video.name}"`);
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
      console.log(`[handler:showcase-remove] Video ${vimeoId} no longer in any mapped showcase, deleting`);
      return handleVideoDelete(vimeoId, log);
    }
  } catch (err) {
    console.error(`[handler:showcase-remove] Error for video ${vimeoId}:`, err instanceof Error ? err.stack : String(err));
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
