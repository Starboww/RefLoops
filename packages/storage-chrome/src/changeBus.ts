// =============================================================================
// RefLoop — changeBus
// Typed wrapper around chrome.storage.onChanged.
// Turns the raw storage event into typed, per-key subscriptions.
// Technical Design §2.4, §3.4
// =============================================================================

export type Unsubscribe = () => void;

/**
 * Subscribe to changes for a specific chrome.storage.local key.
 * Returns an unsubscribe function.
 */
export function onKeyChanged(
  key: string,
  cb: (newValue: unknown) => void,
): Unsubscribe {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local') return;
    if (key in changes && changes[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      cb(changes[key]!.newValue);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Read a key from chrome.storage.local.
 */
export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (key in result ? result[key] : fallback) as T;
}

/**
 * Write a value to chrome.storage.local.
 */
export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove a key from chrome.storage.local.
 */
export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}
