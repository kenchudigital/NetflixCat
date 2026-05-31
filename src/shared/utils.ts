export function now(): number {
  return Date.now();
}

export function createId(prefix = "id"): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function uniqueArray(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  waitMs: number
): (...args: TArgs) => void {
  let timeoutId: number | undefined;

  return (...args: TArgs): void => {
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, waitMs);
  };
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
