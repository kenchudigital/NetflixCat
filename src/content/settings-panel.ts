import { UI_CLASSNAMES } from "../shared/constants";
import type { ExtensionData } from "../shared/types";

export interface SettingsPanelActions {
  onCreateCategory: (name: string, color?: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onClearVideoCategories: (videoId: string) => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (file: File) => Promise<void>;
  onResetData: () => Promise<void>;
}

interface SettingsPanelController {
  updateData: (data: ExtensionData) => void;
  toggle: () => void;
  hide: () => void;
}

function mountRoot(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.settingsPanel}`);
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.className = `${UI_CLASSNAMES.settingsPanel} ${UI_CLASSNAMES.settingsPanelHidden}`;
  document.body.appendChild(root);
  return root;
}

export function mountSettingsPanel(
  initialData: ExtensionData,
  actions: SettingsPanelActions
): SettingsPanelController {
  let currentData = initialData;
  const root = mountRoot();

  const isOpen = (): boolean => !root.classList.contains(UI_CLASSNAMES.settingsPanelHidden);
  const hide = (): void => {
    root.classList.add(UI_CLASSNAMES.settingsPanelHidden);
  };
  const toggle = (): void => {
    root.classList.toggle(UI_CLASSNAMES.settingsPanelHidden);
  };

  document.addEventListener("pointerdown", (event) => {
    if (!isOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (root.contains(target)) {
      return;
    }

    if (target instanceof HTMLElement && target.closest(`.${UI_CLASSNAMES.filterSettingsButton}`)) {
      return;
    }

    hide();
  });

  const setStatus = (message: string) => {
    const status = root.querySelector<HTMLElement>(".nmc-settings-status");
    if (status) {
      status.textContent = message;
    }
  };

  const render = () => {
    root.replaceChildren();

    const card = document.createElement("div");
    card.className = "nmc-settings-card";

    const headingRow = document.createElement("div");
    headingRow.className = "nmc-settings-heading";
    const heading = document.createElement("h3");
    heading.textContent = "Settings";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "nmc-settings-close-button";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", hide);
    headingRow.append(heading, closeButton);
    card.appendChild(headingRow);

    const createSection = document.createElement("div");
    createSection.className = "nmc-settings-section";
    createSection.innerHTML =
      '<div class="nmc-settings-label">Create Category</div><div class="nmc-settings-row"><input class="nmc-settings-input" placeholder="Category name" maxlength="40" /><input class="nmc-settings-color" type="color" value="#e50914" /><button type="button" class="nmc-settings-btn">Add</button></div>';
    const createInput = createSection.querySelector<HTMLInputElement>(".nmc-settings-input");
    const createColor = createSection.querySelector<HTMLInputElement>(".nmc-settings-color");
    const createBtn = createSection.querySelector<HTMLButtonElement>(".nmc-settings-btn");
    createBtn?.addEventListener("click", () => {
      const value = createInput?.value.trim() ?? "";
      if (!value) {
        setStatus("Category name is required.");
        return;
      }
      void actions
        .onCreateCategory(value, createColor?.value)
        .then(() => {
          if (createInput) {
            createInput.value = "";
          }
          setStatus("Category created.");
        })
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : "Create failed.");
        });
    });
    card.appendChild(createSection);

    const listSection = document.createElement("div");
    listSection.className = "nmc-settings-section";
    listSection.innerHTML = '<div class="nmc-settings-label">Categories</div>';
    const list = document.createElement("ul");
    list.className = "nmc-settings-list";
    for (const category of currentData.categories) {
      const item = document.createElement("li");
      item.className = "nmc-settings-list-item";
      const text = document.createElement("span");
      text.textContent = category.name;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Delete";
      removeBtn.className = "nmc-settings-btn danger";
      removeBtn.addEventListener("click", () => {
        void actions
          .onDeleteCategory(category.id)
          .then(() => setStatus("Category deleted."))
          .catch((error: unknown) => {
            setStatus(error instanceof Error ? error.message : "Delete failed.");
          });
      });
      item.append(text, removeBtn);
      list.appendChild(item);
    }
    listSection.appendChild(list);
    card.appendChild(listSection);

    const dataSection = document.createElement("div");
    dataSection.className = "nmc-settings-section";
    dataSection.innerHTML = '<div class="nmc-settings-label">Data</div>';
    const actionsRow = document.createElement("div");
    actionsRow.className = "nmc-settings-row";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "nmc-settings-btn";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", () => {
      void actions.onExportData().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "Export failed.");
      });
    });

    const importLabel = document.createElement("label");
    importLabel.className = "nmc-settings-btn";
    importLabel.textContent = "Import";
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json";
    importInput.hidden = true;
    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];
      if (!file) {
        return;
      }
      void actions
        .onImportData(file)
        .then(() => setStatus("Import complete."))
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : "Import failed.");
        });
      importInput.value = "";
    });
    importLabel.appendChild(importInput);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "nmc-settings-btn danger";
    resetBtn.textContent = "Clear All";
    resetBtn.addEventListener("click", () => {
      void actions
        .onResetData()
        .then(() => setStatus("All data cleared."))
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : "Reset failed.");
        });
    });

    actionsRow.append(exportBtn, importLabel, resetBtn);
    dataSection.appendChild(actionsRow);
    card.appendChild(dataSection);

    const status = document.createElement("p");
    status.className = "nmc-settings-status";
    card.appendChild(status);

    root.appendChild(card);
  };

  render();

  return {
    updateData: (data) => {
      currentData = data;
      render();
    },
    toggle,
    hide
  };
}
