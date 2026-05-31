import { sendMessage } from "../messaging/bus";
import { getEffectiveLocale, t, type AppLocale } from "../i18n";
import { UI_CLASSNAMES } from "../shared/constants";
import type { Category, ExtensionData, NetflixCardInfo } from "../shared/types";

type StateChangeHandler = (data: ExtensionData) => void;

function stopCardNavigation(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

function stopCardNavigationWithoutPreventDefault(event: Event): void {
  event.stopPropagation();
}

function setPreviewSuspended(enabled: boolean): void {
  document.body.classList.toggle(UI_CLASSNAMES.suspendPreview, enabled);
}

function bindNavigationGuards(element: HTMLElement, preventDefault = true): void {
  const guardedEvents = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend"
  ] as const;

  for (const eventName of guardedEvents) {
    element.addEventListener(
      eventName,
      preventDefault ? stopCardNavigation : stopCardNavigationWithoutPreventDefault
    );
  }

  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      if (preventDefault) {
        stopCardNavigation(event);
      } else {
        stopCardNavigationWithoutPreventDefault(event);
      }
    }
  });
}

function renderAssignedTag(
  category: Category,
  onRemove: () => void
): HTMLButtonElement {
  const tagButton = document.createElement("button");
  tagButton.type = "button";
  tagButton.className = "nmc-assigned-tag nmc-assigned-tag-button";
  tagButton.textContent = `${category.name} ×`;
  if (category.color) {
    tagButton.style.backgroundColor = category.color;
  }
  bindNavigationGuards(tagButton);
  tagButton.addEventListener("click", (event) => {
    stopCardNavigation(event);
    onRemove();
  });
  return tagButton;
}

function renderCategorySelect(
  categories: Category[],
  assignedIds: Set<string>,
  locale: AppLocale,
  onToggle: (categoryId: string) => void
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "nmc-category-select";
  select.setAttribute("aria-label", t(locale, "category.addAriaLabel"));

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = t(locale, "category.addPlaceholder");
  select.appendChild(placeholderOption);

  for (const category of categories) {
    if (assignedIds.has(category.id)) {
      continue;
    }
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  }

  bindNavigationGuards(select, false);
  select.addEventListener("pointerenter", () => setPreviewSuspended(true));
  select.addEventListener("pointerleave", () => setPreviewSuspended(false));
  select.addEventListener("focus", () => setPreviewSuspended(true));
  select.addEventListener("blur", () => setPreviewSuspended(false));
  select.addEventListener("change", (event) => {
    stopCardNavigationWithoutPreventDefault(event);
    const value = select.value;
    if (!value) {
      return;
    }
    onToggle(value);
    select.value = "";
  });

  return select;
}

function renderCardFooter(
  footer: HTMLElement,
  assignedCategories: Category[],
  categories: Category[],
  onToggle: (categoryId: string) => void,
  onClearAll: () => void,
  isEditMode: boolean,
  locale: AppLocale
): void {
  footer.hidden = !isEditMode;
  if (!isEditMode) {
    footer.replaceChildren();
    setPreviewSuspended(false);
    return;
  }

  footer.replaceChildren();
  bindNavigationGuards(footer, false);
  footer.addEventListener("pointerenter", () => setPreviewSuspended(true));
  footer.addEventListener("pointerleave", () => setPreviewSuspended(false));

  const assignedRow = document.createElement("div");
  assignedRow.className = UI_CLASSNAMES.cardAssignedTags;
  const assignedIdSet = new Set(assignedCategories.map((category) => category.id));

  if (assignedCategories.length === 0) {
    const emptyHint = document.createElement("span");
    emptyHint.className = UI_CLASSNAMES.cardEmptyHint;
    emptyHint.textContent = t(locale, "category.none");
    assignedRow.appendChild(emptyHint);
  } else {
    for (const category of assignedCategories) {
      assignedRow.appendChild(renderAssignedTag(category, () => onToggle(category.id)));
    }

    const clearAllButton = document.createElement("button");
    clearAllButton.type = "button";
    clearAllButton.className = "nmc-clear-all-button";
    clearAllButton.textContent = t(locale, "common.clearAll");
    bindNavigationGuards(clearAllButton);
    clearAllButton.addEventListener("click", (event) => {
      stopCardNavigation(event);
      onClearAll();
    });
    assignedRow.appendChild(clearAllButton);
  }

  footer.appendChild(assignedRow);

  if (categories.length === 0) {
    const hint = document.createElement("div");
    hint.className = UI_CLASSNAMES.cardEmptyHint;
    hint.textContent = t(locale, "category.createFromPopup");
    footer.appendChild(hint);
    return;
  }

  const picker = document.createElement("div");
  picker.className = UI_CLASSNAMES.cardCategoryPicker;
  picker.appendChild(renderCategorySelect(categories, assignedIdSet, locale, onToggle));

  footer.appendChild(picker);
}

export function annotateCards(
  cards: NetflixCardInfo[],
  state: ExtensionData,
  onStateChange: StateChangeHandler
): void {
  const { categories, videoCategoryMap, ui } = state;
  const locale = getEffectiveLocale(ui.locale);

  for (const card of cards) {
    if (!card.footer) {
      continue;
    }

    const assignedIds = videoCategoryMap[card.videoId] ?? [];
    const assignedCategories = categories.filter((category) => assignedIds.includes(category.id));

    card.footer.classList.toggle("nmc-card-footer-has-category", assignedCategories.length > 0);

    renderCardFooter(
      card.footer,
      assignedCategories,
      categories,
      (categoryId) => {
        void (async () => {
          const response = await sendMessage<ExtensionData>({
            type: "TOGGLE_CATEGORY_FOR_VIDEO",
            payload: { videoId: card.videoId, categoryId }
          });

          if (response.ok) {
            onStateChange(response.data);
          }
        })();
      },
      () => {
        void (async () => {
          const response = await sendMessage<ExtensionData>({
            type: "CLEAR_VIDEO_CATEGORIES",
            payload: { videoId: card.videoId }
          });
          if (response.ok) {
            onStateChange(response.data);
          }
        })();
      },
      ui.editMode,
      locale
    );
  }
}
