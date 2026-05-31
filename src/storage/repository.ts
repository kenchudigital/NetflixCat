import { EXTENSION_STORAGE_KEY } from "../shared/constants";
import type { ExtensionData } from "../shared/types";
import { now } from "../shared/utils";
import { normalizeData } from "./migrations";
import { createEmptyData } from "./schema";

function normalizeForComparison(data: ExtensionData): Omit<ExtensionData, "updatedAt"> {
  const { updatedAt: _ignored, ...rest } = data;
  return rest;
}

function hasMeaningfulChange(current: ExtensionData, next: ExtensionData): boolean {
  return (
    JSON.stringify(normalizeForComparison(current)) !== JSON.stringify(normalizeForComparison(next))
  );
}

async function getRawStorageValue(): Promise<unknown> {
  const result = await chrome.storage.local.get(EXTENSION_STORAGE_KEY);
  return result[EXTENSION_STORAGE_KEY];
}

export async function getData(): Promise<ExtensionData> {
  const raw = await getRawStorageValue();
  return normalizeData(raw);
}

export async function setData(data: ExtensionData): Promise<void> {
  await chrome.storage.local.set({
    [EXTENSION_STORAGE_KEY]: {
      ...data,
      updatedAt: now()
    }
  });
}

export async function updateData(
  updater: (current: ExtensionData) => ExtensionData
): Promise<ExtensionData> {
  const current = await getData();
  const next = updater(current);
  const normalized = normalizeData(next);
  if (!hasMeaningfulChange(current, normalized)) {
    return current;
  }
  normalized.updatedAt = now();
  await setData(normalized);
  return normalized;
}

export async function clearData(): Promise<ExtensionData> {
  const empty = createEmptyData();
  await setData(empty);
  return empty;
}
