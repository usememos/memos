import { InputAction } from "tiny-undo";

/**
 * Define storage data type
 */
interface StorageData {
  // Editor content cache
  editorContentCache: string;
  shouldSplitMemoWord: boolean;
  shouldHideImageUrl: boolean;
  shouldUseMarkdownParser: boolean;

  // Editor setting
  useTinyUndoHistoryCache: boolean;

  // tiny undo actions cache
  tinyUndoActionsCache: InputAction[];
  // tiny undo index cache
  tinyUndoIndexCache: number;
}

type StorageKey = keyof StorageData;

/**
 * storage helper
 */
export namespace storage {
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

  export function emitStorageChangedEvent() {
    const iframeEl = document.createElement("iframe");
    iframeEl.style.display = "none";
    document.body.appendChild(iframeEl);

    iframeEl.contentWindow?.localStorage.setItem("t", Date.now().toString());
    iframeEl.remove();
  }
}
