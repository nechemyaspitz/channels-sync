import {
  VimeoVideo,
  VimeoShowcase,
  VimeoPaginatedResponse,
} from "./types";

const VIMEO_BASE = "https://api.vimeo.com";

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };
}

function getUserId(): string {
  return process.env.VIMEO_USER_ID || "me";
}

export function extractVideoId(uri: string): string {
  // "/videos/123456" → "123456"
  const match = uri.match(/\/videos\/(\d+)/);
  return match ? match[1] : uri;
}

export function extractShowcaseId(uri: string): string {
  // "/users/123/albums/456" → "456"
  const match = uri.match(/\/albums\/(\d+)/);
  return match ? match[1] : uri;
}

async function vimeoFetch<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${VIMEO_BASE}${path}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vimeo API error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Fetch all showcases (albums) for the authenticated user.
 */
export async function fetchAllShowcases(): Promise<VimeoShowcase[]> {
  const showcases: VimeoShowcase[] = [];
  let nextPath: string | null = `/users/${getUserId()}/albums?per_page=100`;

  while (nextPath) {
    const page: VimeoPaginatedResponse<VimeoShowcase> = await vimeoFetch(nextPath);
    showcases.push(...page.data);
    nextPath = page.paging.next;
  }

  return showcases;
}

/**
 * Fetch all videos in a specific showcase.
 */
export async function fetchShowcaseVideos(
  showcaseId: string
): Promise<VimeoVideo[]> {
  const videos: VimeoVideo[] = [];
  let nextPath: string | null = `/users/${getUserId()}/albums/${showcaseId}/videos?per_page=100`;

  while (nextPath) {
    const page: VimeoPaginatedResponse<VimeoVideo> = await vimeoFetch(nextPath);
    videos.push(...page.data);
    nextPath = page.paging.next;
  }

  return videos;
}

/**
 * Fetch a page of videos from a showcase using Vimeo's pagination.
 */
export async function fetchShowcaseVideosPage(
  showcaseId: string,
  page: number,
  perPage: number
): Promise<{ videos: VimeoVideo[]; total: number }> {
  const data: VimeoPaginatedResponse<VimeoVideo> = await vimeoFetch(
    `/users/${getUserId()}/albums/${showcaseId}/videos?per_page=${perPage}&page=${page}`
  );
  return { videos: data.data, total: data.total };
}

/**
 * Fetch a single video by ID.
 */
export async function fetchVideo(videoId: string): Promise<VimeoVideo> {
  return vimeoFetch<VimeoVideo>(`/videos/${videoId}`);
}

/**
 * Get the best thumbnail URL for a video.
 * Prefers the largest available size.
 */
export function getBestThumbnail(video: VimeoVideo): string {
  const sizes = video.pictures?.sizes;
  if (!sizes || sizes.length === 0) return "";
  // Sizes are ordered smallest to largest
  return sizes[sizes.length - 1].link;
}

/**
 * Format duration in seconds to "MM:SS" or "H:MM:SS".
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Get the embed URL for a video.
 */
export function getEmbedUrl(video: VimeoVideo): string {
  const videoId = extractVideoId(video.uri);
  return `https://player.vimeo.com/video/${videoId}`;
}

/**
 * Find which showcases a video belongs to.
 * Returns an array of showcase IDs.
 */
export async function findVideoShowcases(
  videoId: string
): Promise<string[]> {
  const allShowcases = await fetchAllShowcases();
  const showcaseIds: string[] = [];

  for (const showcase of allShowcases) {
    const scId = extractShowcaseId(showcase.uri);
    try {
      // Check if video is in this showcase
      await vimeoFetch(
        `/users/${getUserId()}/albums/${scId}/videos/${videoId}`
      );
      showcaseIds.push(scId);
    } catch {
      // Video not in this showcase, skip
    }
  }

  return showcaseIds;
}
