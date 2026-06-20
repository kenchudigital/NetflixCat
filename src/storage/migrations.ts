import { SCHEMA_VERSION } from "../shared/constants";
import { detectDefaultLocale, normalizeLocalePreference } from "../i18n";
import type { Category, ExtensionData, GridCardSize, UiPreferences, VideoMeta } from "../shared/types";
import { createEmptyData } from "./schema";

function sanitizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry) => typeof entry === "object" && entry !== null)
    .map((entry) => entry as Partial<Category>)
    .filter((entry) => typeof entry.id === "string" && typeof entry.name === "string")
    .map((entry) => ({
      id: entry.id as string,
      name: (entry.name as string).trim(),
      color: typeof entry.color === "string" ? entry.color : undefined,
      createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now()
    }))
    .filter((entry) => entry.name.length > 0);
}

function sanitizeVideoCategoryMap(raw: unknown, validCategoryIds: Set<string>): Record<string, string[]> {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const map = raw as Record<string, unknown>;
  const result: Record<string, string[]> = {};

  for (const [videoId, categoryIds] of Object.entries(map)) {
    if (!Array.isArray(categoryIds)) {
      continue;
    }

    const filtered = categoryIds
      .filter((id) => typeof id === "string")
      .filter((id): id is string => validCategoryIds.has(id));

    if (filtered.length > 0) {
      result[videoId] = Array.from(new Set(filtered));
    }
  }

  return result;
}

function sanitizeVideoMetaMap(raw: unknown): Record<string, VideoMeta> {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const map = raw as Record<string, unknown>;
  const result: Record<string, VideoMeta> = {};

  for (const [videoId, meta] of Object.entries(map)) {
    if (typeof meta === "string") {
      const title = meta.trim();
      if (title.length > 0) {
        result[videoId] = { title };
      }
      continue;
    }

    if (typeof meta !== "object" || meta === null) {
      continue;
    }

    const candidate = meta as Partial<VideoMeta>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    if (title.length > 0) {
      result[videoId] = { title };
    }
  }

  return result;
}

function normalizeGridCardSize(raw: unknown): GridCardSize {
  if (raw === "sm" || raw === "md" || raw === "lg") {
    return raw;
  }
  return "md";
}

function sanitizeUiPreferences(raw: unknown): UiPreferences {
  if (typeof raw !== "object" || raw === null) {
    return {
      editMode: true,
      systemEnabled: true,
      autoScrollScan: false,
      gridCardSize: "md",
      locale: detectDefaultLocale()
    };
  }

  const candidate = raw as Partial<UiPreferences>;
  return {
    editMode: typeof candidate.editMode === "boolean" ? candidate.editMode : true,
    systemEnabled: typeof candidate.systemEnabled === "boolean" ? candidate.systemEnabled : true,
    autoScrollScan: typeof candidate.autoScrollScan === "boolean" ? candidate.autoScrollScan : false,
    gridCardSize: normalizeGridCardSize(candidate.gridCardSize),
    locale: normalizeLocalePreference(candidate.locale)
  };
}

export function normalizeData(raw: unknown): ExtensionData {
  const empty = createEmptyData();
  if (typeof raw !== "object" || raw === null) {
    return empty;
  }

  const candidate = raw as Partial<ExtensionData>;
  const categories = sanitizeCategories(candidate.categories);
  const categoryIdSet = new Set(categories.map((item) => item.id));
  const videoCategoryMap = sanitizeVideoCategoryMap(candidate.videoCategoryMap, categoryIdSet);
  const videoMetaMap = sanitizeVideoMetaMap(
    candidate.videoMetaMap ?? (candidate as { videoTitles?: unknown }).videoTitles
  );
  const ui = sanitizeUiPreferences(candidate.ui);

  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    videoCategoryMap,
    videoMetaMap,
    ui,
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now()
  };
}
