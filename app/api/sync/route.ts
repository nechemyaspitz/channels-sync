import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getMapping } from "@/lib/mapping";
import {
  fetchShowcaseVideos,
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
import { VimeoVideo, WebflowVideoFields } from "@/lib/types";

export const maxDuration = 60;

const BATCH_SIZE = 15;

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

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const showcaseId = body.showcaseId as string | undefined;
  const offset = (body.offset as number) || 0;

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
    const existingItems = await fetchAllVideoItems();
    const allVideos = await fetchShowcaseVideos(showcaseId);
    const batch = allVideos.slice(offset, offset + BATCH_SIZE);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const log: Array<{ action: string; vimeoId: string; videoName: string; details: string }> = [];

    for (const video of batch) {
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
            log.push({ action: "update", vimeoId, videoName: video.name, details: "Updated" });
          } else {
            skipped++;
            log.push({ action: "skip", vimeoId, videoName: video.name, details: "No changes" });
          }
        } else {
          await createVideoItem(fields);
          created++;
          log.push({ action: "create", vimeoId, videoName: video.name, details: "Created" });
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

    const nextOffset = offset + BATCH_SIZE;
    const hasMore = nextOffset < allVideos.length;

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors,
      log,
      total: allVideos.length,
      processed: Math.min(nextOffset, allVideos.length),
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
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
