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

function videoToFields(
  video: VimeoVideo,
  categoryId: string
): WebflowVideoFields {
  const vimeoId = extractVideoId(video.uri);
  return {
    name: video.name,
    slug: generateSlug(video.name, vimeoId),
    video: video.link,                        // Vimeo URL → "video" Link field
    description: video.description || "",
    thumbnail: { url: getBestThumbnail(video), alt: video.name },
    duration: formatDuration(video.duration),  // formatted "M:SS" → "duration" PlainText field
    category: categoryId,
  };
}

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const showcaseId = body.showcaseId as string | undefined;

  if (!showcaseId) {
    return new Response(
      JSON.stringify({ error: "showcaseId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const mapping = getMapping();
  const config = mapping[showcaseId];

  if (!config) {
    return new Response(
      JSON.stringify({ error: "Showcase not found in mapping" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      try {
        send({ type: "status", message: "Fetching existing Webflow items..." });
        const existingItems = await fetchAllVideoItems();

        send({ type: "status", message: `Fetching videos from showcase "${config.showcaseName}"...` });
        const videos = await fetchShowcaseVideos(showcaseId);
        send({ type: "status", message: `Found ${videos.length} videos. Syncing...` });

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
                send({ type: "log", action: "update", vimeoId, videoName: video.name, details: "Updated" });
              } else {
                skipped++;
                send({ type: "log", action: "skip", vimeoId, videoName: video.name, details: "No changes" });
              }
            } else {
              await createVideoItem(fields);
              created++;
              send({ type: "log", action: "create", vimeoId, videoName: video.name, details: "Created" });
            }
          } catch (err) {
            errors++;
            send({
              type: "log",
              action: "error",
              vimeoId,
              videoName: video.name,
              details: err instanceof Error ? err.message : String(err),
            });
          }
        }

        send({ type: "done", created, updated, skipped, errors, total: created + updated + skipped + errors });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
