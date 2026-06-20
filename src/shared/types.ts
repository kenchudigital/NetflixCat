export type AppLocale = "en" | "zh_HK";

export type LocalePreference = AppLocale;

export type GridCardSize = "sm" | "md" | "lg";

export interface Category {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface UiPreferences {
  editMode: boolean;
  systemEnabled: boolean;
  autoScrollScan: boolean;
  gridCardSize: GridCardSize;
  locale: LocalePreference;
}

export interface VideoMeta {
  title: string;
}

export interface ExtensionData {
  schemaVersion: number;
  categories: Category[];
  videoCategoryMap: Record<string, string[]>;
  videoMetaMap: Record<string, VideoMeta>;
  ui: UiPreferences;
  updatedAt: number;
}

export interface NetflixCardInfo {
  videoId: string;
  title: string;
  root: HTMLElement;
  footer?: HTMLElement;
  hideTarget?: HTMLElement;
}

export interface ImportExportPayload {
  schemaVersion: number;
  categories: Category[];
  videoCategoryMap: Record<string, string[]>;
  videoMetaMap: Record<string, VideoMeta>;
  ui: UiPreferences;
  exportedAt: number;
}
