import { annotateCards } from "./card-annotator";
import { mountFilterBar } from "./filter-bar";
import { renderFilteredGrid } from "./filtered-grid";
import { observeMainViewReady } from "./mount-points";
import { getNetflixCards, observeNetflixCards, observeStorageChanges } from "./netflix-dom";
import { getEffectiveLocale } from "../i18n";
import { sendMessage } from "../messaging/bus";
import { NETFLIX_SELECTORS, UI_CLASSNAMES } from "../shared/constants";
import type { ExtensionData } from "../shared/types";

let currentData: ExtensionData | null = null;
let filterBar: ReturnType<typeof mountFilterBar> | null = null;
let lastRenderKey = "";
let titleSyncTimer: number | null = null;
let pendingTitleUpdates: Record<string, string> = {};
let titleSyncInFlight = false;
let bootstrapPromise: Promise<void> | null = null;
let hasBootstrapped = false;
let lastPathname = location.pathname;
let lastDomReady = false;
let domReadyWithoutCardsAt: number | null = null;
let gateRecheckTimer: number | null = null;
let pendingSelectedCategoryIds: string[] | null = null;
let lastAppliedSelectedCategoryIds: string[] = [];
let isAutoLoadingMyList = false;
let autoLoadRunToken = 0;

const MY_LIST_PATH_PREFIX = "/browse/my-list";
const CARD_READINESS_GRACE_MS = 1200; // 1.2 second for the initial loading
const AUTOLOAD_WAIT_MS = 300; // 0.3 second for the loading more videos
const AUTOLOAD_STABLE_ROUNDS = 2;

function isMyListPage(): boolean {
  return location.pathname.startsWith(MY_LIST_PATH_PREFIX);
}

function isMyListDomReady(): boolean {
  if (!isMyListPage()) {
    return false;
  }

  const mainView = document.querySelector<HTMLElement>(NETFLIX_SELECTORS.mainView);
  if (!mainView) {
    return false;
  }

  const hasGalleryHeader = mainView.querySelector<HTMLElement>(NETFLIX_SELECTORS.galleryHeader);
  const hasGallery = mainView.querySelector<HTMLElement>(NETFLIX_SELECTORS.gallery);
  return Boolean(hasGalleryHeader || hasGallery);
}

function isSystemEnabled(data: ExtensionData | null): boolean {
  return data?.ui.systemEnabled ?? true;
}

function hasRenderableNetflixCards(): boolean {
  const mainView = document.querySelector<HTMLElement>(NETFLIX_SELECTORS.mainView);
  if (!mainView) {
    return false;
  }
  return mainView.querySelector(NETFLIX_SELECTORS.card) !== null;
}

function clearGateRecheckTimer(): void {
  if (gateRecheckTimer === null) {
    return;
  }
  window.clearTimeout(gateRecheckTimer);
  gateRecheckTimer = null;
}

function scheduleGateRecheck(delayMs: number): void {
  if (delayMs <= 0 || gateRecheckTimer !== null) {
    return;
  }
  gateRecheckTimer = window.setTimeout(() => {
    gateRecheckTimer = null;
    ensureMyListUi();
  }, delayMs);
}

function getSelectedCategoryIdsForRender(): string[] {
  if (isAutoLoadingMyList) {
    return [];
  }
  return filterBar?.getSelectedCategoryIds() ?? [];
}

function refreshForCurrentSelection(): void {
  const selectedCategoryIds = getSelectedCategoryIdsForRender();
  if (!isAutoLoadingMyList) {
    lastAppliedSelectedCategoryIds = [...selectedCategoryIds];
  }
  refreshCards(selectedCategoryIds);
}

function scrollToTopAfterFilterApply(): void {
  const scrollContainer = getAutoLoadScrollContainer();
  scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
}

function shouldAutoloadBeforeFilter(nextSelectedCategoryIds: string[]): boolean {
  if (!currentData?.ui.autoScrollScan) {
    return false;
  }

  if (!isMyListPage()) {
    return false;
  }

  if (nextSelectedCategoryIds.length === 0) {
    return false;
  }

  if (lastAppliedSelectedCategoryIds.length > 0) {
    return false;
  }

  return true;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getAutoLoadScrollContainer(): HTMLElement {
  const mainView = document.querySelector<HTMLElement>(NETFLIX_SELECTORS.mainView);
  if (mainView && mainView.scrollHeight > mainView.clientHeight + 8) {
    return mainView;
  }

  if (document.scrollingElement instanceof HTMLElement) {
    return document.scrollingElement;
  }

  return document.documentElement;
}

function scrollAutoLoadContainer(container: HTMLElement): void {
  const step = Math.max(Math.floor(container.clientHeight * 0.9), 600);
  const targetTop = Math.min(container.scrollTop + step, container.scrollHeight);
  container.scrollTo({ top: targetTop, behavior: "auto" });
}

function cancelAutoLoadAndApplyPending(): void {
  if (!isAutoLoadingMyList) {
    return;
  }

  autoLoadRunToken += 1;
  isAutoLoadingMyList = false;

  const pending = pendingSelectedCategoryIds ?? [];
  pendingSelectedCategoryIds = null;
  lastAppliedSelectedCategoryIds = [...pending];
  refreshCards(pending);
  scrollToTopAfterFilterApply();
}

async function autoloadMyListAndApplyPendingSelection(initialToken: number): Promise<void> {
  let stableRounds = 0;
  let currentCount = getNetflixCards().length;
  let scrollContainer = getAutoLoadScrollContainer();
  let currentScrollTop = scrollContainer.scrollTop;
  let currentScrollHeight = scrollContainer.scrollHeight;

  refreshForCurrentSelection();

  while (initialToken === autoLoadRunToken) {
    scrollContainer = getAutoLoadScrollContainer();
    scrollAutoLoadContainer(scrollContainer);
    await wait(AUTOLOAD_WAIT_MS);

    const nextCount = getNetflixCards().length;
    scrollContainer = getAutoLoadScrollContainer();
    const nextScrollTop = scrollContainer.scrollTop;
    const nextScrollHeight = scrollContainer.scrollHeight;
    const hasProgress =
      nextCount > currentCount ||
      nextScrollTop > currentScrollTop ||
      nextScrollHeight > currentScrollHeight;

    if (hasProgress) {
      currentCount = Math.max(currentCount, nextCount);
      currentScrollTop = Math.max(currentScrollTop, nextScrollTop);
      currentScrollHeight = Math.max(currentScrollHeight, nextScrollHeight);
      stableRounds = 0;
    } else {
      stableRounds += 1;
    }

    if (stableRounds >= AUTOLOAD_STABLE_ROUNDS) {
      break;
    }
  }

  if (initialToken !== autoLoadRunToken) {
    return;
  }

  isAutoLoadingMyList = false;

  const pending = pendingSelectedCategoryIds ?? [];
  pendingSelectedCategoryIds = null;
  lastAppliedSelectedCategoryIds = [...pending];
  refreshCards(pending);
  scrollToTopAfterFilterApply();
}

function scheduleAutoLoadForSelection(nextSelectedCategoryIds: string[]): void {
  pendingSelectedCategoryIds = nextSelectedCategoryIds;
  if (isAutoLoadingMyList) {
    return;
  }

  isAutoLoadingMyList = true;
  autoLoadRunToken += 1;
  const token = autoLoadRunToken;
  void autoloadMyListAndApplyPendingSelection(token);
}

function shouldEnableExtensionUi(): boolean {
  if (!isMyListDomReady()) {
    domReadyWithoutCardsAt = null;
    clearGateRecheckTimer();
    return false;
  }

  if (!isSystemEnabled(currentData)) {
    clearGateRecheckTimer();
    return false;
  }

  if (hasRenderableNetflixCards()) {
    domReadyWithoutCardsAt = null;
    clearGateRecheckTimer();
    return true;
  }

  const now = Date.now();
  if (domReadyWithoutCardsAt === null) {
    domReadyWithoutCardsAt = now;
  }

  const elapsed = now - domReadyWithoutCardsAt;
  if (elapsed >= CARD_READINESS_GRACE_MS) {
    clearGateRecheckTimer();
    return true;
  }

  scheduleGateRecheck(CARD_READINESS_GRACE_MS - elapsed);
  return false;
}

async function loadData(): Promise<ExtensionData> {
  const response = await sendMessage<ExtensionData>({ type: "GET_ALL_DATA" });
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

function applyState(data: ExtensionData): void {
  currentData = data;
  if (!shouldEnableExtensionUi()) {
    deactivateExtensionUi();
    return;
  }

  activateExtensionUi();
  filterBar?.updateCategories(data.categories);
  filterBar?.updateEditMode(data.ui.editMode);
  filterBar?.updateLocale(getEffectiveLocale(data.ui.locale));
  refreshForCurrentSelection();
}

function setOriginalGalleryHidden(hidden: boolean): void {
  const galleries = Array.from(document.querySelectorAll<HTMLElement>(NETFLIX_SELECTORS.gallery));
  for (const gallery of galleries) {
    gallery.classList.toggle(UI_CLASSNAMES.originalGalleryHidden, hidden);
  }
}

function placeOrphanSectionBelowOriginal(): void {
  const container = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filteredGridContainer}`);
  const gallery = document.querySelector<HTMLElement>(NETFLIX_SELECTORS.gallery);
  if (!container || !gallery || !gallery.parentElement) {
    return;
  }

  if (container.previousElementSibling === gallery) {
    return;
  }

  gallery.insertAdjacentElement("afterend", container);
}

function setSystemUiVisibility(enabled: boolean): void {
  const mount = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.extensionMount}`);
  if (mount) {
    mount.classList.toggle(UI_CLASSNAMES.settingsPanelHidden, !enabled);
  }

  const settings = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.settingsPanel}`);
  if (settings) {
    settings.classList.toggle(UI_CLASSNAMES.settingsPanelHidden, !enabled);
  }
}

function setManagedContentVisibility(enabled: boolean): void {
  const selectors = [
    `.${UI_CLASSNAMES.filterBarContainer}`,
    `.${UI_CLASSNAMES.filteredGridContainer}`,
    `.${UI_CLASSNAMES.cardFooter}`
  ];
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const node of nodes) {
      node.classList.toggle(UI_CLASSNAMES.settingsPanelHidden, !enabled);
    }
  }
}

function activateExtensionUi(): void {
  setSystemUiVisibility(true);
  setManagedContentVisibility(true);
}

function deactivateExtensionUi(): void {
  setSystemUiVisibility(false);
  setManagedContentVisibility(false);
  isAutoLoadingMyList = false;
  pendingSelectedCategoryIds = null;
  autoLoadRunToken += 1;
  setOriginalGalleryHidden(false);
  lastRenderKey = "";
  pendingTitleUpdates = {};
  if (titleSyncTimer !== null) {
    window.clearTimeout(titleSyncTimer);
    titleSyncTimer = null;
  }
}

async function requestDataUpdate(
  request:
    | { type: "SET_EDIT_MODE"; payload: { enabled: boolean } }
    | { type: "CLEAR_VIDEO_CATEGORIES"; payload: { videoId: string } }
    | { type: "REMOVE_VIDEO"; payload: { videoId: string } }
    | { type: "CLEAR_ORPHAN_VIDEOS"; payload: { videoIds: string[] } }
    | { type: "TOGGLE_CATEGORY_FOR_VIDEO"; payload: { videoId: string; categoryId: string } }
    | { type: "ASSIGN_CATEGORY_TO_VIDEO"; payload: { videoId: string; categoryId: string } }
): Promise<void> {
  const response = await sendMessage<ExtensionData>(request);
  if (!response.ok) {
    throw new Error(response.error);
  }
  applyState(response.data);
}

function buildRenderKey(
  selectedCategoryIds: string[],
  cards: ReturnType<typeof getNetflixCards>,
  data: ExtensionData,
  useCustomUi: boolean
): string {
  const cardIds = cards.map((card) => card.videoId).join("|");
  return [
    selectedCategoryIds.join(","),
    useCustomUi ? "custom-1" : "custom-0",
    cardIds,
    String(data.updatedAt),
    data.ui.editMode ? "1" : "0",
    data.ui.gridCardSize ?? "md"
  ].join("::");
}

function collectTitleUpdates(
  cards: ReturnType<typeof getNetflixCards>,
  data: ExtensionData
): Record<string, string> {
  const updates: Record<string, string> = {};
  for (const card of cards) {
    const title = card.title.trim();
    if (!title) {
      continue;
    }
    if (data.videoMetaMap[card.videoId]?.title === title) {
      continue;
    }
    updates[card.videoId] = title;
  }
  return updates;
}

function scheduleTitleSync(): void {
  if (titleSyncTimer !== null || titleSyncInFlight || Object.keys(pendingTitleUpdates).length === 0) {
    return;
  }

  titleSyncTimer = window.setTimeout(() => {
    titleSyncTimer = null;
    void flushTitleSync();
  }, 600);
}

async function flushTitleSync(): Promise<void> {
  if (titleSyncInFlight || Object.keys(pendingTitleUpdates).length === 0) {
    return;
  }

  titleSyncInFlight = true;
  const payload = pendingTitleUpdates;
  pendingTitleUpdates = {};

  try {
    const response = await sendMessage<ExtensionData>({
      type: "UPSERT_VIDEO_TITLES",
      payload: { titles: payload }
    });
    if (response.ok) {
      const previousMeta = JSON.stringify(currentData?.videoMetaMap ?? {});
      currentData = response.data;
      if (JSON.stringify(response.data.videoMetaMap) !== previousMeta) {
        lastRenderKey = "";
        refreshForCurrentSelection();
      }
    }
  } finally {
    titleSyncInFlight = false;
    scheduleTitleSync();
  }
}

function createGridHandlers() {
  return {
    onToggleCategory: (videoId: string, categoryId: string) => {
      void requestDataUpdate({
        type: "TOGGLE_CATEGORY_FOR_VIDEO",
        payload: { videoId, categoryId }
      });
    },
    onAssignCategory: (videoId: string, categoryId: string) => {
      void requestDataUpdate({
        type: "ASSIGN_CATEGORY_TO_VIDEO",
        payload: { videoId, categoryId }
      });
    },
    onClearVideoCategories: (videoId: string) => {
      void requestDataUpdate({
        type: "CLEAR_VIDEO_CATEGORIES",
        payload: { videoId }
      });
    },
    onRemoveVideo: (videoId: string) => {
      void requestDataUpdate({
        type: "REMOVE_VIDEO",
        payload: { videoId }
      });
    },
    onClearOrphanVideos: (videoIds: string[]) => {
      void requestDataUpdate({
        type: "CLEAR_ORPHAN_VIDEOS",
        payload: { videoIds }
      });
    }
  };
}

function refreshCards(selectedCategoryIds: string[]): void {
  if (!currentData) {
    return;
  }
  if (!shouldEnableExtensionUi()) {
    deactivateExtensionUi();
    return;
  }

  activateExtensionUi();
  filterBar?.remount();

  const cards = getNetflixCards();
  const hasFilter = selectedCategoryIds.length > 0;
  const useCustomUi = hasFilter || currentData.ui.editMode;
  const nextRenderKey = buildRenderKey(selectedCategoryIds, cards, currentData, useCustomUi);

  annotateCards(cards, currentData, applyState);
  setOriginalGalleryHidden(useCustomUi);
  if (nextRenderKey !== lastRenderKey) {
    renderFilteredGrid(cards, selectedCategoryIds, currentData, createGridHandlers(), useCustomUi);
    lastRenderKey = nextRenderKey;
  }
  if (!useCustomUi) {
    placeOrphanSectionBelowOriginal();
  }

  const titleUpdates = collectTitleUpdates(cards, currentData);
  if (Object.keys(titleUpdates).length > 0) {
    pendingTitleUpdates = { ...pendingTitleUpdates, ...titleUpdates };
    scheduleTitleSync();
  }
}

function remountExtensionUi(): void {
  if (!shouldEnableExtensionUi()) {
    deactivateExtensionUi();
    return;
  }
  refreshForCurrentSelection();
}

async function bootstrap(): Promise<void> {
  if (!isMyListPage()) {
    deactivateExtensionUi();
    return;
  }

  if (hasBootstrapped) {
    if (!shouldEnableExtensionUi()) {
      deactivateExtensionUi();
      return;
    }
    activateExtensionUi();
    remountExtensionUi();
    return;
  }

  currentData = await loadData();
  if (!isMyListPage()) {
    deactivateExtensionUi();
    return;
  }

  if (!isSystemEnabled(currentData)) {
    deactivateExtensionUi();
  }

  filterBar = mountFilterBar(currentData.categories, {
    initialEditMode: currentData.ui.editMode,
    locale: getEffectiveLocale(currentData.ui.locale),
    onFilterChange: (selectedCategoryIds) => {
      if (!currentData) {
        return;
      }
      if (!isSystemEnabled(currentData)) {
        return;
      }

      if (isAutoLoadingMyList) {
        pendingSelectedCategoryIds = selectedCategoryIds;
        if (selectedCategoryIds.length === 0) {
          cancelAutoLoadAndApplyPending();
        }
        return;
      }

      if (shouldAutoloadBeforeFilter(selectedCategoryIds)) {
        scheduleAutoLoadForSelection(selectedCategoryIds);
        return;
      }

      pendingSelectedCategoryIds = null;
      lastAppliedSelectedCategoryIds = [...selectedCategoryIds];
      refreshCards(selectedCategoryIds);
      scrollToTopAfterFilterApply();
    },
    onEditModeChange: (enabled) => {
      if (!currentData || !isSystemEnabled(currentData)) {
        return;
      }
      if (currentData) {
        currentData = {
          ...currentData,
          ui: { ...currentData.ui, editMode: enabled }
        };
        refreshForCurrentSelection();
      }
      void requestDataUpdate({
        type: "SET_EDIT_MODE",
        payload: { enabled }
      }).catch(() => undefined);
    }
  });

  if (!isSystemEnabled(currentData)) {
    deactivateExtensionUi();
  }

  if (isSystemEnabled(currentData)) {
    refreshForCurrentSelection();
  }

  observeMainViewReady(remountExtensionUi);

  observeNetflixCards(() => {
    refreshForCurrentSelection();
  });

  observeStorageChanges(() => {
    void loadData().then(applyState);
  });

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== "object" || message === null) {
      return;
    }
    const typed = message as { type?: string; payload?: ExtensionData };
    if (typed.type !== "CATEGORY_DATA_UPDATED" || !typed.payload) {
      return;
    }
    applyState(typed.payload);
  });

  hasBootstrapped = true;
}

function ensureMyListUi(): void {
  if (!isMyListPage()) {
    domReadyWithoutCardsAt = null;
    clearGateRecheckTimer();
    deactivateExtensionUi();
    return;
  }

  if (!shouldEnableExtensionUi()) {
    deactivateExtensionUi();
    return;
  }

  if (bootstrapPromise) {
    return;
  }

  bootstrapPromise = bootstrap().finally(() => {
    bootstrapPromise = null;
  });
}

function handleLocationChange(): void {
  const nextPathname = location.pathname;
  const domReady = isMyListDomReady();
  const pathnameChanged = nextPathname !== lastPathname;
  const domReadyChanged = domReady !== lastDomReady;

  if (!pathnameChanged && !domReadyChanged) {
    return;
  }

  lastPathname = nextPathname;
  lastDomReady = domReady;
  if (!domReady) {
    domReadyWithoutCardsAt = null;
  }
  ensureMyListUi();
}

function scheduleLocationCheck(): void {
  window.setTimeout(handleLocationChange, 0);
}

function observeLocationChanges(): void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    const result = originalPushState(...args);
    scheduleLocationCheck();
    return result;
  }) as typeof history.pushState;

  history.replaceState = ((...args: Parameters<typeof history.replaceState>) => {
    const result = originalReplaceState(...args);
    scheduleLocationCheck();
    return result;
  }) as typeof history.replaceState;

  window.addEventListener("popstate", scheduleLocationCheck);

  new MutationObserver(scheduleLocationCheck).observe(document.body, {
    childList: true,
    subtree: true
  });
}

observeLocationChanges();
lastDomReady = isMyListDomReady();
ensureMyListUi();
