import { EXTENSION_STORAGE_KEY, EXTENSION_UI_SELECTOR, NETFLIX_SELECTORS } from "../shared/constants";
import type { NetflixCardInfo } from "../shared/types";
import { debounce } from "../shared/utils";

function parseVideoIdFromHref(href: string | null): string | null {
  if (!href) {
    return null;
  }

  const match = href.match(/\/watch\/(\d+)/);
  return match?.[1] ?? null;
}

function parseVideoIdFromTrackingContext(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  try {
    const jsonText = decodeURIComponent(rawValue);
    const parsed = JSON.parse(jsonText) as { video_id?: number | string };
    if (parsed.video_id === undefined || parsed.video_id === null) {
      return null;
    }
    return String(parsed.video_id);
  } catch {
    return null;
  }
}

function isInPreviewModal(node: HTMLElement): boolean {
  return node.closest(NETFLIX_SELECTORS.previewModal) !== null;
}

function isInMainGallery(node: HTMLElement): boolean {
  return node.closest(NETFLIX_SELECTORS.gallery) !== null;
}

function isExtensionUiNode(node: HTMLElement): boolean {
  return node.closest(EXTENSION_UI_SELECTOR) !== null;
}

function ensureCardFooter(cardRoot: HTMLElement, videoId: string): HTMLElement {
  const existing = cardRoot.parentElement?.querySelector<HTMLElement>(
    `.nmc-card-footer[data-video-id="${videoId}"]`
  );
  if (existing) {
    return existing;
  }

  const footer = document.createElement("div");
  footer.className = "nmc-card-footer";
  footer.dataset.videoId = videoId;
  cardRoot.insertAdjacentElement("afterend", footer);
  return footer;
}

export function getNetflixCards(): NetflixCardInfo[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(NETFLIX_SELECTORS.card));
  const cards: NetflixCardInfo[] = [];

  for (const node of nodes) {
    if (isInPreviewModal(node) || !isInMainGallery(node)) {
      continue;
    }

    const anchor = node.querySelector<HTMLAnchorElement>(NETFLIX_SELECTORS.cardLink);
    const trackingContext = node.getAttribute(NETFLIX_SELECTORS.trackingContextAttr);

    const videoId =
      parseVideoIdFromTrackingContext(trackingContext) ??
      parseVideoIdFromHref(anchor?.getAttribute("href") ?? null);

    if (!videoId) {
      continue;
    }

    const title =
      anchor?.getAttribute("aria-label")?.trim() ??
      node.querySelector<HTMLElement>(NETFLIX_SELECTORS.fallbackTitle)?.innerText?.trim() ??
      `Video ${videoId}`;
    const footer = ensureCardFooter(node, videoId);

    cards.push({
      videoId,
      title,
      root: node,
      footer
    });
  }

  return cards;
}

export function observeNetflixCards(onChange: () => void): MutationObserver {
  const debounced = debounce(onChange, 200);
  const observer = new MutationObserver((mutations) => {
    const hasExternalMutation = mutations.some((mutation) => {
      const target = mutation.target;
      if (target instanceof HTMLElement && isExtensionUiNode(target)) {
        return false;
      }
      if (target instanceof HTMLElement && target.closest(NETFLIX_SELECTORS.previewModal)) {
        return false;
      }

      const affectedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
      if (affectedNodes.length === 0) {
        return false;
      }

      return affectedNodes.some((node) => {
        if (!(node instanceof HTMLElement)) {
          return true;
        }
        if (node.matches(NETFLIX_SELECTORS.previewModal) || node.closest(NETFLIX_SELECTORS.previewModal)) {
          return false;
        }
        if (node.matches(EXTENSION_UI_SELECTOR)) {
          return false;
        }
        return !isExtensionUiNode(node);
      });
    });

    if (hasExternalMutation) {
      debounced();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

export function observeStorageChanges(onChange: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[EXTENSION_STORAGE_KEY]) {
      return;
    }
    onChange();
  });
}
