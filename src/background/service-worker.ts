import {
  assignCategoryToVideo,
  clearAllCategoriesForVideo,
  clearOrphanVideos,
  createCategory,
  deleteCategory,
  reorderCategories,
  removeVideoEntry,
  toggleCategoryForVideo,
  updateCategory,
  upsertVideoTitles
} from "../core/category-service";
import { parseImportPayload, serializeExportPayload } from "../core/export-import-service";
import type { ExtensionRequest, ExtensionResponse, PushMessage } from "../messaging/messages";
import { clearData, getData, setData, updateData } from "../storage/repository";

async function broadcastDataUpdated() {
  const data = await getData();
  const message: PushMessage = { type: "CATEGORY_DATA_UPDATED", payload: data };

  await chrome.runtime.sendMessage(message).catch(() => undefined);

  const tabs = await chrome.tabs.query({ url: "https://www.netflix.com/browse/my-list*" });
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
    }
  }
}

function ok<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function fail(error: unknown): ExtensionResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return { ok: false, error: message };
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse<unknown>) => void
  ) => {
    (async () => {
      try {
        switch (message.type) {
          case "GET_ALL_DATA": {
            sendResponse(ok(await getData()));
            return;
          }
          case "CREATE_CATEGORY": {
            const data = await createCategory(message.payload.name, message.payload.color);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "UPDATE_CATEGORY": {
            const data = await updateCategory(message.payload.categoryId, {
              name: message.payload.name,
              color: message.payload.color
            });
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "REORDER_CATEGORIES": {
            const data = await reorderCategories(message.payload.categoryIds);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "DELETE_CATEGORY": {
            const data = await deleteCategory(message.payload.categoryId);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "TOGGLE_CATEGORY_FOR_VIDEO": {
            const data = await toggleCategoryForVideo(
              message.payload.videoId,
              message.payload.categoryId
            );
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "ASSIGN_CATEGORY_TO_VIDEO": {
            const data = await assignCategoryToVideo(
              message.payload.videoId,
              message.payload.categoryId
            );
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "CLEAR_VIDEO_CATEGORIES": {
            const data = await clearAllCategoriesForVideo(message.payload.videoId);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "REMOVE_VIDEO": {
            const data = await removeVideoEntry(message.payload.videoId);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "CLEAR_ORPHAN_VIDEOS": {
            const data = await clearOrphanVideos(message.payload.videoIds);
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "UPSERT_VIDEO_TITLES": {
            const data = await upsertVideoTitles(message.payload.titles);
            sendResponse(ok(data));
            return;
          }
          case "SET_EDIT_MODE": {
            const data = await updateData((current) => ({
              ...current,
              ui: {
                ...current.ui,
                editMode: message.payload.enabled
              }
            }));
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "SET_SYSTEM_ENABLED": {
            const data = await updateData((current) => ({
              ...current,
              ui: {
                ...current.ui,
                systemEnabled: message.payload.enabled
              }
            }));
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "SET_AUTO_SCROLL_SCAN": {
            const data = await updateData((current) => ({
              ...current,
              ui: {
                ...current.ui,
                autoScrollScan: message.payload.enabled
              }
            }));
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "SET_LOCALE": {
            const data = await updateData((current) => ({
              ...current,
              ui: {
                ...current.ui,
                locale: message.payload.locale
              }
            }));
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          case "IMPORT_DATA": {
            const parsed = parseImportPayload(message.payload.json);
            await setData(parsed);
            const latest = await getData();
            sendResponse(ok(latest));
            await broadcastDataUpdated();
            return;
          }
          case "EXPORT_DATA": {
            const data = await getData();
            sendResponse(ok({ json: serializeExportPayload(data), data }));
            return;
          }
          case "RESET_ALL_DATA": {
            const data = await clearData();
            sendResponse(ok(data));
            await broadcastDataUpdated();
            return;
          }
          default: {
            sendResponse(fail("Unsupported action."));
          }
        }
      } catch (error) {
        sendResponse(fail(error));
      }
    })();

    return true;
  }
);
