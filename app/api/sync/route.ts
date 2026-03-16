import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getMapping } from "@/lib/mapping";
import {
  fetchShowcaseVideosPage,
  extractVideoId,
  getBestThumbnail,
  formatDuration,
} from "@/lib/vimeo";
import {
  fetchAllVideoItems,
  createVideoItem,
  updateVideoItem,
  generateSlug,
} from "@/lib/webflow";
import { VimeoVideo, WebflowVideoFields, WebflowItem } from "@/lib/types";

export const maxDuration = 60;

const BATCH_SIZE = 10;

function videoToFields(
  video: VimeoVideo,
  categoryId: string
): WebflowVideoFields {
  const vimeoId = extractVideoId(video.uri);
  return {
    name: video.name,
    slug: generateSlug(video.name, vimeoId),
    video: video.link,
    description: video.description || "",
    thumbnail: { url: getBestThumbnail(video), alt: video.name },
    duration: formatDuration(video.duration),
    category: categoryId,
  };
}

// Cache Webflow items across batches within a single deployment instance
let webflowItemsCache: Map<string, WebflowItem> | null = null;
let webflowCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getWebflowItems(): Promise<Map<string, WebflowItem>> {
  const now = Date.now();
  if (webflowItemsCache && now - webflowCacheTime < CACHE_TTL) {
    return webflowItemsCache;
  }
  webflowItemsCache = await fetchAllVideoItems();
  webflowCacheTime = now;
  return webflowItemsCache;
}

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const showcaseId = body.showcaseId as string | undefined;
  const page = (body.page as number) || 1;

  if (!showcaseId) {
    return NextResponse.json(
      { error: "showcaseId is required" },
      { status: 400 }
    );
  }

  const mapping = getMapping();
  const config = mapping[showcaseId];

  if (!config) {
    return NextResponse.json(
      { error: "Showcase not found in mapping" },
      { status: 400 }
    );
  }

  try {
    // Fetch only the page of videos we need from Vimeo
    const { videos, total } = await fetchShowcaseVideosPage(
      showcaseId,
      page,
      BATCH_SIZE
    );

    // Fetch existing Webflow items (cached across batches)
    const existingItems = await getWebflowItems();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const log: Array<{
      action: string;
      vimeoId: string;
      videoName: string;
      details: string;
    }> = [];

    for (const video of videos) {
      const vimeoId = extractVideoId(video.uri);
      const fields = videoToFields(video, config.webflowCategoryId);

      try {
        const existing = existingItems.get(vimeoId);

        if (existing) {
          const ef = existing.fieldData;
          const changed =
            ef.name !== fields.name ||
            ef.description !== fields.description ||
            ef.duration !== fields.duration ||
            ef.video !== fields.video;

          if (changed) {
            await updateVideoItem(existing.id, fields);
            updated++;
            log.push({
              action: "update",
              vimeoId,
              videoName: video.name,
              details: "Updated",
            });
          } else {
            skipped++;
            log.push({
              action: "skip",
              vimeoId,
              videoName: video.name,
              details: "No changes",
            });
          }
        } else {
          await createVideoItem(fields);
          created++;
          log.push({
            action: "create",
            vimeoId,
            videoName: video.name,
            details: "Created",
          });
        }
      } catch (err) {
        errors++;
        log.push({
          action: "error",
          vimeoId,
          videoName: video.name,
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const processed = Math.min(page * BATCH_SIZE, total);
    const hasMore = processed < total;

    // Invalidate cache when done so next sync gets fresh data
    if (!hasMore) {
      webflowItemsCache = null;
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors,
      log,
      total,
      processed,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Sync failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
