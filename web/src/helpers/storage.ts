/**
 * Define storage data type
 */
interface StorageData {
  // Editor content cache
  editorContentCache: string;
  // Editing memo id cache
  editingMemoIdCache: MemoId;
  // Editing memo visibility
  editingMemoVisibilityCache: Visibility;
  // locale
  locale: Locale;
  // skipped version
  skippedVersion: string;
}

type StorageKey = keyof StorageData;

/**
 * storage helper
 */
export function get(keys: StorageKey[]): Partial<StorageData> {
  const data: Partial<StorageData> = {};

  for (const key of keys) {
    try {
      const stringifyValue = localStorage.getItem(key);
      if (stringifyValue !== null) {
        const val = JSON.parse(stringifyValue);
        data[key] = val;
      }
    } catch (error: any) {
      console.error("Get storage failed in ", key, error);
    }
  }

  return data;
}

export function set(data: Partial<StorageData>) {
  for (const key in data) {
    try {
      const stringifyValue = JSON.stringify(data[key as StorageKey]);
      localStorage.setItem(key, stringifyValue);
    } catch (error: any) {
      console.error("Save storage failed in ", key, error);
    }
  }
}

export function remove(keys: StorageKey[]) {
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch (error: any) {
      console.error("Remove storage failed in ", key, error);
    }
  }
}
