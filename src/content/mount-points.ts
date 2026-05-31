import { NETFLIX_SELECTORS, UI_CLASSNAMES } from "../shared/constants";

export function getMainView(): HTMLElement | null {
  return document.querySelector<HTMLElement>(NETFLIX_SELECTORS.mainView);
}

function placeMountInMainView(mainView: HTMLElement, mount: HTMLElement): void {
  const galleryHeader = mainView.querySelector<HTMLElement>(NETFLIX_SELECTORS.galleryHeader);
  if (galleryHeader) {
    if (mount.parentElement !== mainView || mount.previousElementSibling !== galleryHeader) {
      galleryHeader.insertAdjacentElement("afterend", mount);
    }
    return;
  }

  const gallery = mainView.querySelector<HTMLElement>(NETFLIX_SELECTORS.gallery);
  if (gallery) {
    if (mount.parentElement !== mainView || mount.nextElementSibling !== gallery) {
      gallery.insertAdjacentElement("beforebegin", mount);
    }
    return;
  }

  if (mount.parentElement !== mainView || mount !== mainView.firstElementChild) {
    mainView.insertBefore(mount, mainView.firstChild);
  }
}

export function ensureExtensionMount(): HTMLElement | null {
  const mainView = getMainView();
  if (!mainView) {
    return null;
  }

  const mount =
    document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.extensionMount}`) ??
    document.createElement("div");
  mount.className = UI_CLASSNAMES.extensionMount;

  placeMountInMainView(mainView, mount);

  return mount;
}

function findFilterBarContainer(): HTMLElement | null {
  const mainView = getMainView();
  if (mainView) {
    const container = mainView.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filterBarContainer}`);
    if (container) {
      return container;
    }
  }

  return document.querySelector<HTMLElement>(`.${UI_CLASSNAMES.filterBarContainer}`);
}

export function ensureFilterBarPlacement(container: HTMLElement): boolean {
  const mount = ensureExtensionMount();
  if (!mount) {
    return false;
  }

  if (container.parentElement !== mount) {
    mount.insertBefore(container, mount.firstChild);
  }

  return true;
}

export function ensureFilteredGridPlacement(container: HTMLElement): boolean {
  const mount = ensureExtensionMount();
  if (!mount) {
    return false;
  }

  const filterContainer = findFilterBarContainer();
  if (filterContainer && mount.contains(filterContainer)) {
    if (container.parentElement !== mount || container.previousElementSibling !== filterContainer) {
      filterContainer.insertAdjacentElement("afterend", container);
    }
    return true;
  }

  if (container.parentElement !== mount) {
    mount.appendChild(container);
  }

  return true;
}

export function observeMainViewReady(onReady: () => void): void {
  if (getMainView()) {
    onReady();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!getMainView()) {
      return;
    }
    observer.disconnect();
    onReady();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
