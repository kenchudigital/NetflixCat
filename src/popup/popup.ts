import { sendMessage } from "../messaging/bus";
import { getEffectiveLocale, normalizeLocalePreference, t } from "../i18n";
import type { ExtensionData } from "../shared/types";

const createForm = document.querySelector<HTMLFormElement>("#create-category-form");
const categoryNameInput = document.querySelector<HTMLInputElement>("#category-name-input");
const categoryColorInput = document.querySelector<HTMLInputElement>("#category-color-input");
const categoriesList = document.querySelector<HTMLUListElement>("#categories-list");
const exportButton = document.querySelector<HTMLButtonElement>("#export-button");
const importFileInput = document.querySelector<HTMLInputElement>("#import-file-input");
const languageSelect = document.querySelector<HTMLSelectElement>("#language-select");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");
const systemToggle = document.querySelector<HTMLInputElement>("#system-toggle");
const autoScrollToggle = document.querySelector<HTMLInputElement>("#auto-scroll-toggle");
const statusText = document.querySelector<HTMLParagraphElement>("#status-text");
const systemDependentSections = Array.from(
  document.querySelectorAll<HTMLElement>("[data-requires-system]")
);

let currentData: ExtensionData | null = null;
let editingCategoryId: string | null = null;
let dragSourceCategoryId: string | null = null;

function locale() {
  return getEffectiveLocale(currentData?.ui.locale);
}

function translate(key: Parameters<typeof t>[1]): string {
  return t(locale(), key);
}

function setStatus(message: string): void {
  if (statusText) {
    statusText.textContent = message;
  }
}

function setLocalizedStatus(key: Parameters<typeof t>[1]): void {
  setStatus(translate(key));
}

function localizeError(error: string): string {
  if (error === "Category name already exists.") {
    return translate("popup.status.categoryNameExists");
  }
  if (error === "Category name cannot be empty.") {
    return translate("popup.status.categoryNameRequired");
  }
  return error;
}

function refreshCategoryViews(): void {
  renderLanguageState();
  renderStaticText();
  renderCategories();
}

function isSystemEnabled(): boolean {
  return currentData?.ui.systemEnabled ?? true;
}

function isDataEmpty(data: ExtensionData | null): boolean {
  if (!data) {
    return true;
  }
  return (
    data.categories.length === 0 &&
    Object.keys(data.videoCategoryMap).length === 0
  );
}

function renderSystemState(): void {
  const enabled = isSystemEnabled();
  if (systemToggle) {
    systemToggle.checked = enabled;
  }
  if (autoScrollToggle && currentData) {
    autoScrollToggle.checked = currentData.ui.autoScrollScan;
  }

  for (const section of systemDependentSections) {
    section.classList.toggle("is-disabled", !enabled);
  }
}

function renderLanguageState(): void {
  if (languageSelect && currentData) {
    languageSelect.value = currentData.ui.locale;
  }
}

function renderStaticText(): void {
  document.documentElement.lang = locale() === "zh_HK" ? "zh-HK" : "en";
  document.title = translate("popup.title");

  for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"))) {
    const key = element.dataset.i18n;
    if (key) {
      element.textContent = translate(key as Parameters<typeof t>[1]);
    }
  }

  for (const element of Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")
  )) {
    const key = element.dataset.i18nPlaceholder;
    if (key) {
      element.placeholder = translate(key as Parameters<typeof t>[1]);
    }
  }
}

async function saveCategoryEdit(categoryId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    setLocalizedStatus("popup.status.categoryNameRequired");
    return;
  }

  const response = await sendMessage<ExtensionData>({
    type: "UPDATE_CATEGORY",
    payload: { categoryId, name: trimmed }
  });

  if (!response.ok) {
    setStatus(localizeError(response.error));
    return;
  }

  editingCategoryId = null;
  currentData = response.data;
  refreshCategoryViews();
  setLocalizedStatus("popup.status.categoryUpdated");
}

async function persistCategoryOrder(sourceId: string, targetId: string): Promise<void> {
  if (!currentData || sourceId === targetId) {
    return;
  }

  const ids = currentData.categories.map((item) => item.id);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  ids.splice(sourceIndex, 1);
  ids.splice(targetIndex, 0, sourceId);

  const response = await sendMessage<ExtensionData>({
    type: "REORDER_CATEGORIES",
    payload: { categoryIds: ids }
  });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  refreshCategoryViews();
  setLocalizedStatus("popup.status.categoryOrderUpdated");
}

function renderCategories(): void {
  if (!categoriesList || !currentData) {
    return;
  }

  categoriesList.replaceChildren();

  for (const category of currentData.categories) {
    const item = document.createElement("li");
    item.className = "category-row";
    item.dataset.categoryId = category.id;
    const isEditing = editingCategoryId === category.id;

    item.addEventListener("dragover", (event) => {
      if (!dragSourceCategoryId || dragSourceCategoryId === category.id || isEditing) {
        return;
      }
      event.preventDefault();
      item.classList.add("is-drag-over");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("is-drag-over");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("is-drag-over");
      const sourceId = event.dataTransfer?.getData("text/plain") || dragSourceCategoryId;
      if (!sourceId || sourceId === category.id) {
        return;
      }
      void persistCategoryOrder(sourceId, category.id);
    });

    if (!isEditing) {
      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "category-drag-handle";
      dragHandle.draggable = true;
      dragHandle.setAttribute("aria-label", translate("popup.dragHandleAriaLabel"));
      dragHandle.textContent = "⋮⋮";
      dragHandle.addEventListener("dragstart", (event) => {
        dragSourceCategoryId = category.id;
        item.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", category.id);
        }
      });
      dragHandle.addEventListener("dragend", () => {
        dragSourceCategoryId = null;
        item.classList.remove("is-dragging");
        for (const row of Array.from(categoriesList.querySelectorAll(".category-row"))) {
          row.classList.remove("is-drag-over");
        }
      });
      item.appendChild(dragHandle);
    }

    const nameBlock = document.createElement("div");
    nameBlock.className = "category-name";

    if (isEditing) {
      const editInput = document.createElement("input");
      editInput.type = "text";
      editInput.className = "category-edit-input";
      editInput.maxLength = 40;
      editInput.value = category.name;
      nameBlock.appendChild(editInput);
      requestAnimationFrame(() => {
        editInput.focus();
        editInput.select();
      });

      const editActions = document.createElement("div");
      editActions.className = "category-row-actions";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = translate("common.save");
      saveButton.addEventListener("click", () => {
        void saveCategoryEdit(category.id, editInput.value);
      });

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.textContent = translate("common.cancel");
      cancelButton.addEventListener("click", () => {
        editingCategoryId = null;
        renderCategories();
      });

      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void saveCategoryEdit(category.id, editInput.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          editingCategoryId = null;
          renderCategories();
        }
      });

      editActions.append(saveButton, cancelButton);
      item.append(nameBlock, editActions);
    } else {
      const dot = document.createElement("span");
      dot.className = "category-dot";
      dot.style.background = category.color ?? "#e50914";

      const text = document.createElement("span");
      text.className = "category-label";
      text.textContent = category.name;

      nameBlock.append(dot, text);

      const actions = document.createElement("div");
      actions.className = "category-row-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = translate("common.edit");
      editButton.addEventListener("click", () => {
        editingCategoryId = category.id;
        renderCategories();
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "danger";
      removeButton.textContent = translate("common.delete");
      removeButton.addEventListener("click", async () => {
        const response = await sendMessage<ExtensionData>({
          type: "DELETE_CATEGORY",
          payload: { categoryId: category.id }
        });

        if (!response.ok) {
          setStatus(response.error);
          return;
        }

        if (editingCategoryId === category.id) {
          editingCategoryId = null;
        }
        currentData = response.data;
        refreshCategoryViews();
        setLocalizedStatus("popup.status.categoryDeleted");
      });

      actions.append(editButton, removeButton);
      item.append(nameBlock, actions);
    }

    categoriesList.appendChild(item);
  }
}

async function loadData(): Promise<void> {
  const response = await sendMessage<ExtensionData>({ type: "GET_ALL_DATA" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  renderLanguageState();
  renderStaticText();
  renderSystemState();
  renderCategories();
}

async function handleCreateCategory(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!isSystemEnabled()) {
    setLocalizedStatus("popup.status.systemOff");
    return;
  }

  const name = categoryNameInput?.value.trim() ?? "";
  if (!name) {
    setLocalizedStatus("popup.status.categoryNameRequired");
    return;
  }

  const color = categoryColorInput?.value;
  const response = await sendMessage<ExtensionData>({
    type: "CREATE_CATEGORY",
    payload: { name, color }
  });

  if (!response.ok) {
    setStatus(localizeError(response.error));
    return;
  }

  currentData = response.data;
  refreshCategoryViews();

  if (categoryNameInput) {
    categoryNameInput.value = "";
  }
  setLocalizedStatus("popup.status.categoryCreated");
}

async function handleExport(): Promise<void> {
  if (!isSystemEnabled()) {
    setLocalizedStatus("popup.status.systemOff");
    return;
  }
  const response = await sendMessage<{ json: string }>({ type: "EXPORT_DATA" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  const blob = new Blob([response.data.json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `netflix-my-list-categories-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setLocalizedStatus("popup.status.exportedJson");
}

async function handleImport(file: File): Promise<void> {
  if (!isSystemEnabled()) {
    setLocalizedStatus("popup.status.systemOff");
    return;
  }
  if (!isDataEmpty(currentData)) {
    setLocalizedStatus("popup.status.clearBeforeImport");
    return;
  }
  const text = await file.text();
  const response = await sendMessage<ExtensionData>({
    type: "IMPORT_DATA",
    payload: { json: text }
  });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  refreshCategoryViews();
  setLocalizedStatus("popup.status.importComplete");
}

async function handleReset(): Promise<void> {
  if (!isSystemEnabled()) {
    setLocalizedStatus("popup.status.systemOff");
    return;
  }
  const confirmed = window.confirm(translate("popup.confirm.deleteAll"));
  if (!confirmed) {
    return;
  }

  const response = await sendMessage<ExtensionData>({ type: "RESET_ALL_DATA" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  editingCategoryId = null;
  currentData = response.data;
  refreshCategoryViews();
  setLocalizedStatus("popup.status.allDataCleared");
}

async function handleSystemToggle(): Promise<void> {
  if (!systemToggle) {
    return;
  }

  const response = await sendMessage<ExtensionData>({
    type: "SET_SYSTEM_ENABLED",
    payload: { enabled: systemToggle.checked }
  });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  renderLanguageState();
  renderStaticText();
  renderSystemState();
  renderCategories();
  setLocalizedStatus(
    systemToggle.checked ? "popup.status.systemEnabled" : "popup.status.systemDisabled"
  );
}

async function handleAutoScrollToggle(): Promise<void> {
  if (!autoScrollToggle) {
    return;
  }

  const response = await sendMessage<ExtensionData>({
    type: "SET_AUTO_SCROLL_SCAN",
    payload: { enabled: autoScrollToggle.checked }
  });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  renderLanguageState();
  renderStaticText();
  renderSystemState();
  renderCategories();
  setLocalizedStatus(
    autoScrollToggle.checked
      ? "popup.status.autoScrollScanEnabled"
      : "popup.status.autoScrollScanDisabled"
  );
}

async function handleLanguageChange(): Promise<void> {
  if (!languageSelect) {
    return;
  }

  const response = await sendMessage<ExtensionData>({
    type: "SET_LOCALE",
    payload: { locale: normalizeLocalePreference(languageSelect.value) }
  });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  currentData = response.data;
  renderLanguageState();
  renderStaticText();
  renderSystemState();
  renderCategories();
  setLocalizedStatus("popup.status.languageUpdated");
}

if (createForm) {
  createForm.addEventListener("submit", (event) => {
    void handleCreateCategory(event as SubmitEvent);
  });
}

if (exportButton) {
  exportButton.addEventListener("click", () => {
    void handleExport();
  });
}

if (importFileInput) {
  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files?.[0];
    if (!file) {
      return;
    }
    void handleImport(file);
    importFileInput.value = "";
  });
}

if (languageSelect) {
  languageSelect.addEventListener("change", () => {
    void handleLanguageChange();
  });
}

if (resetButton) {
  resetButton.addEventListener("click", () => {
    void handleReset();
  });
}

if (systemToggle) {
  systemToggle.addEventListener("change", () => {
    void handleSystemToggle();
  });
}

if (autoScrollToggle) {
  autoScrollToggle.addEventListener("change", () => {
    void handleAutoScrollToggle();
  });
}

void loadData();