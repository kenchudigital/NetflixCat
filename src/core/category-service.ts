import type { Category, ExtensionData } from "../shared/types";
import { createId, isNonEmptyString, uniqueArray } from "../shared/utils";
import { updateData } from "../storage/repository";

function isCategoryNameTaken(
  categories: Category[],
  name: string,
  excludeCategoryId?: string
): boolean {
  const normalized = name.toLowerCase();
  return categories.some(
    (item) =>
      item.id !== excludeCategoryId && item.name.toLowerCase() === normalized
  );
}

export async function createCategory(name: string, color?: string): Promise<ExtensionData> {
  const trimmed = name.trim();
  if (!isNonEmptyString(trimmed)) {
    throw new Error("Category name cannot be empty.");
  }

  return updateData((current) => {
    if (isCategoryNameTaken(current.categories, trimmed)) {
      throw new Error("Category name already exists.");
    }

    const newCategory: Category = {
      id: createId("cat"),
      name: trimmed,
      color,
      createdAt: Date.now()
    };

    return {
      ...current,
      categories: [...current.categories, newCategory]
    };
  });
}

export async function updateCategory(
  categoryId: string,
  updates: { name?: string; color?: string }
): Promise<ExtensionData> {
  return updateData((current) => {
    const index = current.categories.findIndex((item) => item.id === categoryId);
    if (index === -1) {
      throw new Error("Category does not exist.");
    }

    const existing = current.categories[index];
    let nextName = existing.name;
    let nextColor = existing.color;

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!isNonEmptyString(trimmed)) {
        throw new Error("Category name cannot be empty.");
      }
      if (isCategoryNameTaken(current.categories, trimmed, categoryId)) {
        throw new Error("Category name already exists.");
      }
      nextName = trimmed;
    }

    if (updates.color !== undefined) {
      nextColor = updates.color;
    }

    const categories = [...current.categories];
    categories[index] = {
      ...existing,
      name: nextName,
      color: nextColor
    };

    return {
      ...current,
      categories
    };
  });
}

export async function reorderCategories(categoryIds: string[]): Promise<ExtensionData> {
  return updateData((current) => {
    if (categoryIds.length !== current.categories.length) {
      throw new Error("Invalid category order.");
    }

    const byId = new Map(current.categories.map((item) => [item.id, item]));
    const categories: Category[] = [];

    for (const categoryId of categoryIds) {
      const category = byId.get(categoryId);
      if (!category) {
        throw new Error("Invalid category order.");
      }
      categories.push(category);
    }

    return {
      ...current,
      categories
    };
  });
}

export async function deleteCategory(categoryId: string): Promise<ExtensionData> {
  return updateData((current) => {
    const categories = current.categories.filter((item) => item.id !== categoryId);
    const videoCategoryMap: Record<string, string[]> = {};
    const videoMetaMap = { ...current.videoMetaMap };

    for (const [videoId, categoryIds] of Object.entries(current.videoCategoryMap)) {
      const filtered = categoryIds.filter((id) => id !== categoryId);
      if (filtered.length > 0) {
        videoCategoryMap[videoId] = filtered;
      } else {
        delete videoMetaMap[videoId];
      }
    }

    return {
      ...current,
      categories,
      videoCategoryMap,
      videoMetaMap
    };
  });
}

export async function assignCategoryToVideo(
  videoId: string,
  categoryId: string
): Promise<ExtensionData> {
  return updateData((current) => {
    const exists = current.categories.some((item) => item.id === categoryId);
    if (!exists) {
      throw new Error("Category does not exist.");
    }

    const existingIds = current.videoCategoryMap[videoId] ?? [];
    return {
      ...current,
      videoCategoryMap: {
        ...current.videoCategoryMap,
        [videoId]: uniqueArray([...existingIds, categoryId])
      }
    };
  });
}

export async function unassignCategoryFromVideo(
  videoId: string,
  categoryId: string
): Promise<ExtensionData> {
  return updateData((current) => {
    const currentIds = current.videoCategoryMap[videoId] ?? [];
    const nextIds = currentIds.filter((id) => id !== categoryId);
    const videoCategoryMap = { ...current.videoCategoryMap };

    if (nextIds.length === 0) {
      delete videoCategoryMap[videoId];
    } else {
      videoCategoryMap[videoId] = nextIds;
    }

    return {
      ...current,
      videoCategoryMap
    };
  });
}

export async function toggleCategoryForVideo(
  videoId: string,
  categoryId: string
): Promise<ExtensionData> {
  return updateData((current) => {
    const currentIds = current.videoCategoryMap[videoId] ?? [];
    const hasCategory = currentIds.includes(categoryId);
    const nextIds = hasCategory
      ? currentIds.filter((id) => id !== categoryId)
      : uniqueArray([...currentIds, categoryId]);
    const videoCategoryMap = { ...current.videoCategoryMap };

    if (nextIds.length === 0) {
      delete videoCategoryMap[videoId];
    } else {
      videoCategoryMap[videoId] = nextIds;
    }

    return {
      ...current,
      videoCategoryMap
    };
  });
}

export async function clearAllCategoriesForVideo(videoId: string): Promise<ExtensionData> {
  return updateData((current) => {
    const videoCategoryMap = { ...current.videoCategoryMap };
    const videoMetaMap = { ...current.videoMetaMap };
    delete videoCategoryMap[videoId];
    delete videoMetaMap[videoId];

    return {
      ...current,
      videoCategoryMap,
      videoMetaMap
    };
  });
}

export async function removeVideoEntry(videoId: string): Promise<ExtensionData> {
  return updateData((current) => {
    const videoCategoryMap = { ...current.videoCategoryMap };
    const videoMetaMap = { ...current.videoMetaMap };
    delete videoCategoryMap[videoId];
    delete videoMetaMap[videoId];

    return {
      ...current,
      videoCategoryMap,
      videoMetaMap
    };
  });
}

export async function clearOrphanVideos(videoIds: string[]): Promise<ExtensionData> {
  const toRemove = new Set(videoIds);
  return updateData((current) => {
    const videoCategoryMap = { ...current.videoCategoryMap };
    const videoMetaMap = { ...current.videoMetaMap };

    for (const videoId of toRemove) {
      delete videoCategoryMap[videoId];
      delete videoMetaMap[videoId];
    }

    return {
      ...current,
      videoCategoryMap,
      videoMetaMap
    };
  });
}

export async function upsertVideoTitles(titles: Record<string, string>): Promise<ExtensionData> {
  return updateData((current) => {
    const videoMetaMap = { ...current.videoMetaMap };
    let changed = false;

    for (const [videoId, rawTitle] of Object.entries(titles)) {
      const title = rawTitle.trim();
      if (!title) {
        continue;
      }

      const existing = videoMetaMap[videoId];
      if (existing?.title === title) {
        continue;
      }

      videoMetaMap[videoId] = { title };
      changed = true;
    }

    if (!changed) {
      return current;
    }

    return {
      ...current,
      videoMetaMap
    };
  });
}
