import { ensureFilterBarPlacement } from "./mount-points";
import { t, type AppLocale } from "../i18n";
import { UI_CLASSNAMES } from "../shared/constants";
import type { Category } from "../shared/types";

export interface FilterBarOptions {
  initialEditMode: boolean;
  locale: AppLocale;
  onFilterChange: (selectedCategoryIds: string[]) => void;
  onEditModeChange: (enabled: boolean) => void;
}

interface FilterBarController {
  getSelectedCategoryIds: () => string[];
  updateCategories: (categories: Category[]) => void;
  updateEditMode: (enabled: boolean) => void;
  updateLocale: (locale: AppLocale) => void;
  remount: () => void;
}

function createCategoriesSignature(categories: Category[]): string {
  return categories.map((item) => `${item.id}:${item.name}:${item.color ?? ""}`).join("|");
}

function mountFilterRoot(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filterBarRoot}`);
  const existingContainer = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filterBarContainer}`);

  if (existing && existingContainer) {
    ensureFilterBarPlacement(existingContainer);
    return existing;
  }

  const container = document.createElement("div");
  container.className = UI_CLASSNAMES.filterBarContainer;

  const root = document.createElement("div");
  root.className = UI_CLASSNAMES.filterBarRoot;
  container.appendChild(root);

  if (!ensureFilterBarPlacement(container)) {
    document.body.appendChild(container);
  }

  return root;
}

export function mountFilterBar(
  categories: Category[],
  options: FilterBarOptions
): FilterBarController {
  let selectedCategoryId: string | null = null;
  let currentCategories = categories;
  let categoriesSignature = createCategoriesSignature(categories);
  let editMode = options.initialEditMode;
  let helpVisible = false;
  let locale = options.locale;
  let root = mountFilterRoot();

  const setVisibility = () => {
    root.classList.remove(UI_CLASSNAMES.filterBarHidden);
    root.hidden = false;
  };

  const render = () => {
    root = mountFilterRoot();
    setVisibility();

    root.replaceChildren();

    const row = document.createElement("div");
    row.className = "nmc-filter-row nmc-filter-row-main";

    const select = document.createElement("select");
    select.className = "nmc-filter-select";
    select.setAttribute("aria-label", t(locale, "filter.categoryAriaLabel"));

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = t(locale, "filter.allCategories");
    select.appendChild(allOption);

    for (const category of currentCategories) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    }

    select.value = selectedCategoryId ?? "";
    select.addEventListener("change", () => {
      selectedCategoryId = select.value || null;
      options.onFilterChange(selectedCategoryId ? [selectedCategoryId] : []);
    });
    row.appendChild(select);

    const separator = document.createElement("span");
    separator.className = "nmc-filter-separator";
    separator.textContent = "|";
    row.appendChild(separator);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = `${UI_CLASSNAMES.filterEditToggle} nmc-filter-edit-button`;
    editButton.textContent = t(locale, "filter.manageCategory");
    if (editMode) {
      editButton.classList.add("is-active");
    }
    editButton.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      editMode = !editMode;
      editButton.classList.toggle("is-active", editMode);
      options.onEditModeChange(editMode);
    });
    row.appendChild(editButton);

    const createSeparator = document.createElement("span");
    createSeparator.className = "nmc-filter-separator";
    createSeparator.textContent = "|";
    row.appendChild(createSeparator);

    const helpButton = document.createElement("button");
    helpButton.type = "button";
    helpButton.className = "nmc-filter-help-button";
    helpButton.textContent = t(locale, "filter.createCategory");
    helpButton.setAttribute("aria-label", t(locale, "filter.createCategoryAriaLabel"));
    helpButton.setAttribute("aria-expanded", String(helpVisible));
    if (helpVisible) {
      helpButton.classList.add("is-active");
    }
    helpButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      helpVisible = !helpVisible;
      render();
    });
    row.appendChild(helpButton);

    const helpMessage = document.createElement("div");
    helpMessage.className = "nmc-filter-help-message";
    helpMessage.hidden = !helpVisible;
    helpMessage.textContent = t(locale, "filter.createCategoryHelp");

    const emptyHint = document.createElement("div");
    emptyHint.className = "nmc-filter-empty-hint";
    emptyHint.hidden = currentCategories.length > 0;
    emptyHint.textContent = t(locale, "filter.createFirstCategoryHint");

    root.appendChild(row);
    root.appendChild(helpMessage);
    root.appendChild(emptyHint);
  };

  render();

  return {
    getSelectedCategoryIds: () => (selectedCategoryId ? [selectedCategoryId] : []),
    updateCategories: (categoriesToSet) => {
      const nextSignature = createCategoriesSignature(categoriesToSet);
      if (nextSignature === categoriesSignature) {
        return;
      }
      const previousSelectedCategoryId = selectedCategoryId;
      currentCategories = categoriesToSet;
      categoriesSignature = nextSignature;
      if (
        selectedCategoryId &&
        !categoriesToSet.some((category) => category.id === selectedCategoryId)
      ) {
        selectedCategoryId = null;
      }
      render();
      if (previousSelectedCategoryId !== selectedCategoryId) {
        options.onFilterChange(selectedCategoryId ? [selectedCategoryId] : []);
      }
    },
    updateEditMode: (enabled) => {
      editMode = enabled;
      const editButton = root.querySelector<HTMLButtonElement>(`.nmc-filter-edit-button`);
      if (editButton) {
        editButton.classList.toggle("is-active", enabled);
        return;
      }
      render();
    },
    updateLocale: (localeToSet) => {
      if (localeToSet === locale) {
        return;
      }
      locale = localeToSet;
      render();
    },
    remount: () => {
      render();
    }
  };
}
