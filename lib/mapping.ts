import { ShowcaseCategoryMapping } from "./types";
import fs from "fs";
import path from "path";

const MAPPING_FILE = path.join(process.cwd(), "config", "mapping.json");

/**
 * Load the showcase → category mapping from the config file.
 */
export function loadMapping(): ShowcaseCategoryMapping {
  try {
    const raw = fs.readFileSync(MAPPING_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save the showcase → category mapping to the config file.
 * Note: On Vercel, the filesystem is read-only so this only works locally.
 * For production, we store in env var or use an external store.
 */
export function saveMapping(mapping: ShowcaseCategoryMapping): void {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

/**
 * Get the mapping, preferring the SHOWCASE_MAPPING env var if set.
 * Format: JSON string of ShowcaseCategoryMapping
 */
export function getMapping(): ShowcaseCategoryMapping {
  if (process.env.SHOWCASE_MAPPING) {
    try {
      return JSON.parse(process.env.SHOWCASE_MAPPING);
    } catch {
      console.error("Failed to parse SHOWCASE_MAPPING env var");
    }
  }
  return loadMapping();
}
