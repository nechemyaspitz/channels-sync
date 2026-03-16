import {
  VimeoVideo,
  WebflowVideoFields,
  SyncLogEntry,
  SyncResult,
} from "./types";
import { getMapping } from "./mapping";
import {
  fetchShowcaseVideos,
  extractVideoId,
  getBestThumbnail,
  formatDuration,
  getEmbedUrl,
} from "./vimeo";
import {
  fetchAllVideoItems,
  createVideoItem,
  updateVideoItem,
  publishItems,
  generateSlug,
} from "./webflow";

/**
 * Convert a Vimeo video to Webflow CMS fields.
 */
function videoToFields(
  video: VimeoVideo,
  categoryId: string
): WebflowVideoFields {
  const vimeoId = extractVideoId(video.uri);
  return {
    name: video.name,
    slug: generateSlug(video.name, vimeoId),
    "vimeo-video-id": vimeoId,
    description: video.description || "",
    "duration-seconds": video.duration,
    "duration-display": formatDuration(video.duration),
    "embed-url": getEmbedUrl(video),
    thumbnail: {
      url: getBestThumbnail(video),
      alt: video.name,
    },
    "vimeo-url": video.link,
    tags: video.tags?.map((t) => t.name).join(", ") || "",
    category: categoryId,
  };
}

/**
 * Check if a Webflow item needs updating based on the Vimeo video data.
 */
function needsUpdate(
  existing: Record<string, unknown>,
  incoming: WebflowVideoFields
): boolean {
  // Compare key fields to see if an update is needed
  if (existing.name !== incoming.name) return true;
  if (existing.description !== incoming.description) return true;
  if (existing["duration-seconds"] !== incoming["duration-seconds"]) return true;
  if (existing["embed-url"] !== incoming["embed-url"]) return true;
  if (existing["vimeo-url"] !== incoming["vimeo-url"]) return true;
  if (existing.tags !== incoming.tags) return true;
  return false;
}

/**
 * Run a bulk sync for one or all showcases.
 */
export async function runBulkSync(
  showcaseId?: string
): Promise<SyncResult> {
  const mapping = getMapping();
  const log: SyncLogEntry[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Build a map of existing Webflow items by Vimeo ID
  const existingItems = await fetchAllVideoItems();
  const itemsToPublish: string[] = [];

  // Determine which showcases to sync
  const showcaseIds = showcaseId
    ? [showcaseId]
    : Object.keys(mapping);

  for (const scId of showcaseIds) {
    const config = mapping[scId];
    if (!config) {
      log.push({
        timestamp: new Date().toISOString(),
        action: "error",
        vimeoId: "",
        videoName: "",
        details: `Showcase ${scId} not found in mapping, skipping`,
      });
      errors++;
      continue;
    }

    try {
      const videos = await fetchShowcaseVideos(scId);

      for (const video of videos) {
        const vimeoId = extractVideoId(video.uri);
        const fields = videoToFields(video, config.webflowCategoryId);

        try {
          const existing = existingItems.get(vimeoId);

          if (existing) {
            // Check if update is needed
            if (needsUpdate(existing.fieldData, fields)) {
              const result = await updateVideoItem(existing.id, fields);
              itemsToPublish.push(result.id);
              updated++;
              log.push({
                timestamp: new Date().toISOString(),
                action: "update",
                vimeoId,
                videoName: video.name,
                details: `Updated in category "${config.categoryName}"`,
              });
            } else {
              skipped++;
              log.push({
                timestamp: new Date().toISOString(),
                action: "skip",
                vimeoId,
                videoName: video.name,
                details: "No changes detected",
              });
            }
          } else {
            // Create new item
            const result = await createVideoItem(fields);
            itemsToPublish.push(result.id);
            created++;
            log.push({
              timestamp: new Date().toISOString(),
              action: "create",
              vimeoId,
              videoName: video.name,
              details: `Created in category "${config.categoryName}"`,
            });
          }
        } catch (err) {
          errors++;
          log.push({
            timestamp: new Date().toISOString(),
            action: "error",
            vimeoId,
            videoName: video.name,
            details: `Error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    } catch (err) {
      errors++;
      log.push({
        timestamp: new Date().toISOString(),
        action: "error",
        vimeoId: "",
        videoName: "",
        details: `Failed to fetch showcase ${scId}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Publish all created/updated items
  if (itemsToPublish.length > 0) {
    try {
      await publishItems(itemsToPublish);
      log.push({
        timestamp: new Date().toISOString(),
        action: "publish",
        vimeoId: "",
        videoName: "",
        details: `Published ${itemsToPublish.length} items`,
      });
    } catch (err) {
      log.push({
        timestamp: new Date().toISOString(),
        action: "error",
        vimeoId: "",
        videoName: "",
        details: `Publish failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    success: errors === 0,
    totalProcessed: created + updated + skipped + errors,
    created,
    updated,
    skipped,
    errors,
    log,
  };
}
