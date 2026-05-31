import type { ExtensionData } from "../shared/types";

export function shouldShowVideo(
  videoId: string,
  selectedCategoryIds: string[],
  data: ExtensionData
): boolean {
  if (selectedCategoryIds.length === 0) {
    return true;
  }

  const assigned = data.videoCategoryMap[videoId] ?? [];
  return selectedCategoryIds.some((id) => assigned.includes(id));
}
