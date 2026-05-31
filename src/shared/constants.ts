export const EXTENSION_STORAGE_KEY = "netflixMyListData";
export const SCHEMA_VERSION = 1;

export const NETFLIX_SELECTORS = {
  mainView: ".mainView",
  card: ".ptrack-content",
  cardLink: "a[href*='/watch/']",
  fallbackTitle: ".fallback-text",
  trackingContextAttr: "data-ui-tracking-context",
  pinningHeader: ".pinning-header",
  gallery: ".gallery.row-with-x-columns",
  galleryHeader: ".galleryHeader",
  previewModal:
    ".focus-trap-wrapper.previewModal-wrapper.mini-modal, .previewModal-wrapper, .mini-modal, .focus-trap-wrapper"
} as const;

export const NETFLIX_WATCH_URL_PREFIX = "https://www.netflix.com/watch/";

export const EXTENSION_UI_SELECTOR =
  ".nmc-extension-mount, .nmc-filter-bar, .nmc-filter-bar-container, .nmc-filtered-grid-container, .nmc-settings-panel, .nmc-card-footer";

export const UI_CLASSNAMES = {
  extensionMount: "nmc-extension-mount",
  cardFooter: "nmc-card-footer",
  cardAssignedTags: "nmc-card-assigned",
  cardCategoryPicker: "nmc-card-picker",
  cardEmptyHint: "nmc-card-empty-hint",
  categoryChip: "nmc-category-chip",
  categoryChipAssigned: "is-assigned",
  filterBarContainer: "nmc-filter-bar-container",
  filterBarRoot: "nmc-filter-bar",
  filterEditToggle: "nmc-filter-edit-toggle",
  filterSettingsButton: "nmc-filter-settings-button",
  filterBarHidden: "nmc-filter-bar-hidden",
  settingsPanel: "nmc-settings-panel",
  settingsPanelHidden: "nmc-settings-panel-hidden",
  filteredGridContainer: "nmc-filtered-grid-container",
  filteredGrid: "nmc-filtered-grid",
  filteredGridCard: "nmc-filtered-grid-card",
  orphanSection: "nmc-orphan-section",
  orphanGrid: "nmc-orphan-grid",
  originalGalleryHidden: "nmc-original-gallery-hidden",
  hiddenByFilter: "nmc-hidden-by-filter",
  suspendPreview: "nmc-suspend-preview"
} as const;
