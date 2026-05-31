import type { ExtensionData, LocalePreference } from "../shared/types";

export type ExtensionRequest =
  | { type: "GET_ALL_DATA" }
  | { type: "CREATE_CATEGORY"; payload: { name: string; color?: string } }
  | { type: "UPDATE_CATEGORY"; payload: { categoryId: string; name?: string; color?: string } }
  | { type: "REORDER_CATEGORIES"; payload: { categoryIds: string[] } }
  | { type: "DELETE_CATEGORY"; payload: { categoryId: string } }
  | { type: "TOGGLE_CATEGORY_FOR_VIDEO"; payload: { videoId: string; categoryId: string } }
  | { type: "ASSIGN_CATEGORY_TO_VIDEO"; payload: { videoId: string; categoryId: string } }
  | { type: "CLEAR_VIDEO_CATEGORIES"; payload: { videoId: string } }
  | { type: "REMOVE_VIDEO"; payload: { videoId: string } }
  | { type: "CLEAR_ORPHAN_VIDEOS"; payload: { videoIds: string[] } }
  | { type: "UPSERT_VIDEO_TITLES"; payload: { titles: Record<string, string> } }
  | { type: "SET_EDIT_MODE"; payload: { enabled: boolean } }
  | { type: "SET_SYSTEM_ENABLED"; payload: { enabled: boolean } }
  | { type: "SET_AUTO_SCROLL_SCAN"; payload: { enabled: boolean } }
  | { type: "SET_LOCALE"; payload: { locale: LocalePreference } }
  | { type: "IMPORT_DATA"; payload: { json: string } }
  | { type: "EXPORT_DATA" }
  | { type: "RESET_ALL_DATA" };

export interface SuccessResponse<T = ExtensionData> {
  ok: true;
  data: T;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type ExtensionResponse<T = ExtensionData> = SuccessResponse<T> | ErrorResponse;

export type PushMessage = { type: "CATEGORY_DATA_UPDATED"; payload: ExtensionData };
