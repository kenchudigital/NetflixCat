import { SCHEMA_VERSION } from "../shared/constants";
import { detectDefaultLocale } from "../i18n";
import type { ExtensionData } from "../shared/types";

export function createEmptyData(): ExtensionData {
  return {
    schemaVersion: SCHEMA_VERSION,
    categories: [],
    videoCategoryMap: {},
    videoMetaMap: {},
    ui: {
      editMode: true,
      systemEnabled: true,
      autoScrollScan: false,
      gridCardSize: "md",
      locale: detectDefaultLocale()
    },
    updatedAt: Date.now()
  };
}
