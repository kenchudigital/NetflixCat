import { ensureFilteredGridPlacement } from "./mount-points";
import { getEffectiveLocale, t } from "../i18n";
import { NETFLIX_SELECTORS, NETFLIX_WATCH_URL_PREFIX, UI_CLASSNAMES } from "../shared/constants";
import type { ExtensionData, NetflixCardInfo } from "../shared/types";

type ToggleHandler = (videoId: string, categoryId: string) => void;
type AssignHandler = (videoId: string, categoryId: string) => void;
type ClearVideoHandler = (videoId: string) => void;
type RemoveVideoHandler = (videoId: string) => void;
type ClearOrphanHandler = (videoIds: string[]) => void;

export interface FilteredGridHandlers {
  onToggleCategory: ToggleHandler;
  onAssignCategory: AssignHandler;
  onClearVideoCategories: ClearVideoHandler;
  onRemoveVideo: RemoveVideoHandler;
  onClearOrphanVideos: ClearOrphanHandler;
}

function watchUrl(videoId: string): string {
  return `${NETFLIX_WATCH_URL_PREFIX}${videoId}`;
}

function getVideoTitle(videoId: string, data: ExtensionData): string {
  return data.videoMetaMap[videoId]?.title ?? `Video ${videoId}`;
}

type MyListAction = "add";

function createIconSvg(pathData: string): SVGElement {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
}

function createRoundIconButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nmc-grid-icon-button";
  button.appendChild(createIconSvg("M11 11V2h2v9h9v2h-9v9h-2v-9H2v-2z"));
  return button;
}

function getNativeMyListSelectors(_action: MyListAction): string[] {
  return [
    "button[data-uia='add-to-my-list']",
    "button[data-uia='add-to-my-list'][aria-label*='口袋名單']",
    "button[data-uia='add-to-my-list'][aria-label*='My List']"
  ];
}

function setOriginalGalleryVisibility(visible: boolean): HTMLElement[] {
  const galleries = Array.from(document.querySelectorAll<HTMLElement>(NETFLIX_SELECTORS.gallery));
  for (const gallery of galleries) {
    gallery.classList.toggle(UI_CLASSNAMES.originalGalleryHidden, !visible);
  }
  return galleries;
}

function collectSearchScopes(cardRoot: HTMLElement): HTMLElement[] {
  const scopes: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const pushScope = (node: HTMLElement | null) => {
    if (!node || seen.has(node)) {
      return;
    }
    seen.add(node);
    scopes.push(node);
  };

  pushScope(cardRoot);
  pushScope(cardRoot.closest<HTMLElement>(".title-card, .title-card-container, .slider-item, li"));
  pushScope(cardRoot.closest<HTMLElement>("[data-list-context], [data-trackinguuid], [data-videoid]"));

  let parent: HTMLElement | null = cardRoot.parentElement;
  let depth = 0;
  while (parent && depth < 8) {
    pushScope(parent);
    parent = parent.parentElement;
    depth += 1;
  }

  return scopes;
}

function collectSearchScopesByVideoId(videoId: string): HTMLElement[] {
  const anchorSelectors = [
    `a[href*='/watch/${videoId}']`,
    `[data-ui-tracking-context*='\"video_id\":${videoId}']`,
    `[data-ui-tracking-context*='\"video_id\":\"${videoId}\"']`
  ];

  const scopes: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const pushScope = (node: HTMLElement | null) => {
    if (!node || seen.has(node)) {
      return;
    }
    seen.add(node);
    scopes.push(node);
  };

  for (const selector of anchorSelectors) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const node of nodes) {
      pushScope(node);
      pushScope(node.closest<HTMLElement>(".title-card, .title-card-container, .slider-item, li"));
      pushScope(node.closest<HTMLElement>("[data-list-context], [data-trackinguuid], [data-videoid]"));
    }
  }

  return scopes;
}

function clickFirstMatchingButton(scopes: HTMLElement[], selectors: string[]): boolean {
  for (const scope of scopes) {
    for (const selector of selectors) {
      const button = scope.querySelector<HTMLButtonElement>(selector);
      if (!button) {
        continue;
      }
      button.click();
      return true;
    }
  }
  return false;
}

async function clickNativeMyListButton(
  cardRoot: HTMLElement,
  videoId: string,
  action: MyListAction
): Promise<boolean> {
  setOriginalGalleryVisibility(true);
  const hoverTarget =
    cardRoot.closest<HTMLElement>(".title-card, .title-card-container, .slider-item, li") ?? cardRoot;

  hoverTarget.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  hoverTarget.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const scopes = [...collectSearchScopes(cardRoot), ...collectSearchScopesByVideoId(videoId)];
  const clicked = clickFirstMatchingButton(scopes, getNativeMyListSelectors(action));
  if (clicked) {
    setOriginalGalleryVisibility(false);
    return true;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const clickedFallback = clickFirstMatchingButton(scopes, getNativeMyListSelectors(action));
  setOriginalGalleryVisibility(false);
  return clickedFallback;
}

function mountContainer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filteredGridContainer}`);
  if (existing) {
    ensureFilteredGridPlacement(existing);
    return existing;
  }

  const container = document.createElement("section");
  container.className = UI_CLASSNAMES.filteredGridContainer;

  const grid = document.createElement("div");
  grid.className = UI_CLASSNAMES.filteredGrid;
  container.appendChild(grid);

  const orphanSection = document.createElement("section");
  orphanSection.className = `${UI_CLASSNAMES.orphanSection} ${UI_CLASSNAMES.settingsPanelHidden}`;
  container.appendChild(orphanSection);

  if (!ensureFilteredGridPlacement(container)) {
    document.body.appendChild(container);
  }

  return container;
}

function getGridRoot(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filteredGrid}`);
  if (!grid) {
    throw new Error("Filtered grid root missing.");
  }
  return grid;
}

function getOrphanSection(container: HTMLElement): HTMLElement {
  const section = container.querySelector<HTMLElement>(`.${UI_CLASSNAMES.orphanSection}`);
  if (!section) {
    throw new Error("Orphan section missing.");
  }
  return section;
}

function cardMatchesFilter(
  videoId: string,
  selectedCategoryIds: string[],
  videoCategoryMap: Record<string, string[]>
): boolean {
  if (selectedCategoryIds.length === 0) {
    return true;
  }

  const assigned = videoCategoryMap[videoId] ?? [];
  return selectedCategoryIds.some((categoryId) => assigned.includes(categoryId));
}

function bindSelectGuards(select: HTMLSelectElement): void {
  const stop = (event: Event): void => {
    event.stopPropagation();
  };
  select.addEventListener("pointerdown", stop);
  select.addEventListener("mousedown", stop);
  select.addEventListener("click", stop);
}

function appendCategoryControls(
  wrapper: HTMLElement,
  videoId: string,
  assignedIds: Set<string>,
  data: ExtensionData,
  handlers: FilteredGridHandlers
): void {
  if (!data.ui.editMode) {
    return;
  }

  const assigned = data.categories.filter((category) => assignedIds.has(category.id));

  if (assigned.length > 0) {
    const tags = document.createElement("div");
    tags.className = "nmc-grid-tags";
    for (const category of assigned) {
      const tagBtn = document.createElement("button");
      tagBtn.type = "button";
      tagBtn.className = "nmc-assigned-tag nmc-assigned-tag-button";
      tagBtn.textContent = `${category.name} ×`;
      if (category.color) {
        tagBtn.style.backgroundColor = category.color;
      }
      tagBtn.addEventListener("click", () => handlers.onToggleCategory(videoId, category.id));
      tags.appendChild(tagBtn);
    }

    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.className = "nmc-clear-all-button";
    clearAllBtn.textContent = t(getEffectiveLocale(data.ui.locale), "common.clearAll");
    clearAllBtn.addEventListener("click", () => handlers.onClearVideoCategories(videoId));
    tags.appendChild(clearAllBtn);
    wrapper.appendChild(tags);
  }

  if (data.categories.length > 0) {
    const select = document.createElement("select");
    select.className = "nmc-category-select";
    bindSelectGuards(select);

    const first = document.createElement("option");
    first.value = "";
    first.textContent = t(getEffectiveLocale(data.ui.locale), "category.addPlaceholder");
    select.appendChild(first);

    for (const category of data.categories) {
      if (assignedIds.has(category.id)) {
        continue;
      }
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      const categoryId = select.value;
      select.value = "";
      if (!categoryId) {
        return;
      }
      handlers.onAssignCategory(videoId, categoryId);
    });
    wrapper.appendChild(select);
  } else {
    const hint = document.createElement("div");
    hint.className = "nmc-grid-empty-hint";
    hint.textContent = t(getEffectiveLocale(data.ui.locale), "category.createFromPopupDetailed");
    wrapper.appendChild(hint);
  }
}

function buildCard(
  card: NetflixCardInfo,
  data: ExtensionData,
  handlers: FilteredGridHandlers
): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = UI_CLASSNAMES.filteredGridCard;

  const anchor = card.root.querySelector<HTMLAnchorElement>("a[href*='/watch/']");
  const img = card.root.querySelector<HTMLImageElement>("img");

  const link = document.createElement("a");
  link.href = anchor?.href ?? watchUrl(card.videoId);
  link.target = "_self";
  link.className = "nmc-grid-link";

  const image = document.createElement("img");
  image.className = "nmc-grid-image";
  image.src = img?.src ?? "";
  image.alt = card.title;
  link.appendChild(image);
  wrapper.appendChild(link);

  const title = document.createElement("a");
  title.href = watchUrl(card.videoId);
  title.target = "_self";
  title.className = "nmc-grid-title nmc-grid-title-link";
  title.textContent = card.title;
  wrapper.appendChild(title);

  const assignedIds = new Set(data.videoCategoryMap[card.videoId] ?? []);
  appendCategoryControls(wrapper, card.videoId, assignedIds, data, handlers);

  return wrapper;
}

function buildOrphanCard(
  videoId: string,
  data: ExtensionData,
  handlers: FilteredGridHandlers
): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = `${UI_CLASSNAMES.filteredGridCard} nmc-orphan-card`;

  const titleRow = document.createElement("div");
  titleRow.className = "nmc-orphan-title-row";

  const title = document.createElement("a");
  title.href = watchUrl(videoId);
  title.target = "_self";
  title.className = "nmc-grid-title nmc-grid-title-link";
  title.textContent = getVideoTitle(videoId, data);
  titleRow.appendChild(title);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "nmc-orphan-remove-button";
  removeBtn.setAttribute("aria-label", t(getEffectiveLocale(data.ui.locale), "grid.removeImportedVideo"));
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => handlers.onRemoveVideo(videoId));
  titleRow.appendChild(removeBtn);
  wrapper.appendChild(titleRow);

  const note = document.createElement("div");
  note.className = "nmc-orphan-note";
  note.textContent = t(getEffectiveLocale(data.ui.locale), "grid.notOnMyList");
  wrapper.appendChild(note);

  const assignedIds = new Set(data.videoCategoryMap[videoId] ?? []);
  appendCategoryControls(wrapper, videoId, assignedIds, data, handlers);

  return wrapper;
}

function getOrphanEntries(
  visibleVideoIds: Set<string>,
  selectedCategoryIds: string[],
  data: ExtensionData
): Array<[string, string[]]> {
  return Object.entries(data.videoCategoryMap).filter(([videoId, categoryIds]) => {
    if (visibleVideoIds.has(videoId) || categoryIds.length === 0) {
      return false;
    }
    return cardMatchesFilter(videoId, selectedCategoryIds, data.videoCategoryMap);
  });
}

function renderOrphanSection(
  orphanSection: HTMLElement,
  orphanEntries: Array<[string, string[]]>,
  data: ExtensionData,
  handlers: FilteredGridHandlers
): void {
  orphanSection.replaceChildren();

  if (orphanEntries.length === 0) {
    orphanSection.classList.add(UI_CLASSNAMES.settingsPanelHidden);
    return;
  }

  orphanSection.classList.remove(UI_CLASSNAMES.settingsPanelHidden);

  const header = document.createElement("div");
  header.className = "nmc-orphan-header";

  const heading = document.createElement("h4");
  heading.className = "nmc-orphan-heading";
  heading.textContent = t(getEffectiveLocale(data.ui.locale), "grid.importedNotOnMyList");
  header.appendChild(heading);

  const helpTrigger = document.createElement("span");
  helpTrigger.className = "nmc-orphan-help-trigger";
  helpTrigger.textContent = "!";
  helpTrigger.setAttribute("tabindex", "0");
  helpTrigger.setAttribute("role", "button");
  helpTrigger.setAttribute(
    "aria-label",
    t(getEffectiveLocale(data.ui.locale), "grid.importedNotOnMyListHelp")
  );

  const helpTooltip = document.createElement("span");
  helpTooltip.className = "nmc-orphan-help-tooltip";
  helpTooltip.textContent = t(getEffectiveLocale(data.ui.locale), "grid.importedNotOnMyListHelp");
  helpTrigger.appendChild(helpTooltip);
  header.appendChild(helpTrigger);

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.className = "nmc-orphan-clear-all-button";
  clearAllBtn.textContent = t(getEffectiveLocale(data.ui.locale), "common.clearAll");
  clearAllBtn.addEventListener("click", () => {
    handlers.onClearOrphanVideos(orphanEntries.map(([videoId]) => videoId));
  });
  header.appendChild(clearAllBtn);
  orphanSection.appendChild(header);

  const orphanGrid = document.createElement("div");
  orphanGrid.className = UI_CLASSNAMES.orphanGrid;
  for (const [videoId] of orphanEntries) {
    orphanGrid.appendChild(buildOrphanCard(videoId, data, handlers));
  }
  orphanSection.appendChild(orphanGrid);
}

export function renderFilteredGrid(
  cards: NetflixCardInfo[],
  selectedCategoryIds: string[],
  data: ExtensionData,
  handlers: FilteredGridHandlers,
  showMainGrid = true
): void {
  const container = mountContainer();
  ensureFilteredGridPlacement(container);

  const grid = getGridRoot(container);
  const orphanSection = getOrphanSection(container);
  const visibleVideoIds = new Set(cards.map((card) => card.videoId));

  grid.replaceChildren();
  if (showMainGrid) {
    const displayCards = cards.filter((card) =>
      cardMatchesFilter(card.videoId, selectedCategoryIds, data.videoCategoryMap)
    );
    for (const card of displayCards) {
      grid.appendChild(buildCard(card, data, handlers));
    }
  }

  const orphanEntries = getOrphanEntries(visibleVideoIds, selectedCategoryIds, data);
  renderOrphanSection(orphanSection, orphanEntries, data, handlers);

  const shouldHideContainer = !showMainGrid && orphanEntries.length === 0;
  container.classList.toggle(UI_CLASSNAMES.settingsPanelHidden, shouldHideContainer);
}
