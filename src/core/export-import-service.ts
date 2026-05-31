import type { ExtensionData, ImportExportPayload } from "../shared/types";
import { normalizeData } from "../storage/migrations";

export function toExportPayload(data: ExtensionData): ImportExportPayload {
  return {
    schemaVersion: data.schemaVersion,
    categories: data.categories,
    videoCategoryMap: data.videoCategoryMap,
    videoMetaMap: data.videoMetaMap,
    ui: data.ui,
    exportedAt: Date.now()
  };
}

export function serializeExportPayload(data: ExtensionData): string {
  return JSON.stringify(toExportPayload(data), null, 2);
}

export function parseImportPayload(text: string): ExtensionData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  return normalizeData(parsed);
}
