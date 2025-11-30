import { makeObservable, observable } from "mobx";
import { StandardState } from "./base-store";

const LOCAL_STORAGE_KEY = "memos-view-setting";

export type LayoutMode = "LIST" | "MASONRY";

class ViewState extends StandardState {
  // Sort order: true = ascending (oldest first), false = descending (newest first)
  orderByTimeAsc: boolean = false;
  // Display layout mode: LIST (vertical list) or MASONRY (Pinterest-style grid)
  layout: LayoutMode = "LIST";

  constructor() {
    super();
    makeObservable(this, {
      orderByTimeAsc: observable,
      layout: observable,
    });
  }

  setPartial(partial: Partial<ViewState>): void {
    // Validate layout if provided
    if (partial.layout !== undefined && !["LIST", "MASONRY"].includes(partial.layout)) {
      console.warn(`Invalid layout "${partial.layout}", ignoring`);
      return;
    }

    Object.assign(this, partial);

    // Persist to localStorage
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          orderByTimeAsc: this.orderByTimeAsc,
          layout: this.layout,
        }),
      );
    } catch (error) {
      console.warn("Failed to persist view settings:", error);
    }
  }
}

const viewStore = (() => {
  const state = new ViewState();

  // Load from localStorage on initialization
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const data = JSON.parse(cached);

      // Validate and restore orderByTimeAsc
      if (Object.hasOwn(data, "orderByTimeAsc")) {
        state.orderByTimeAsc = Boolean(data.orderByTimeAsc);
      }

      // Validate and restore layout
      if (Object.hasOwn(data, "layout") && ["LIST", "MASONRY"].includes(data.layout)) {
        state.layout = data.layout as LayoutMode;
      }
    }
  } catch (error) {
    console.warn("Failed to load view settings from localStorage:", error);
  }

  const toggleSortOrder = (): void => {
    state.setPartial({ orderByTimeAsc: !state.orderByTimeAsc });
  };

  const setLayout = (layout: LayoutMode): void => {
    state.setPartial({ layout });
  };

  const resetToDefaults = (): void => {
    state.setPartial({
      orderByTimeAsc: false,
      layout: "LIST",
    });
  };

  const clearStorage = (): void => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    state,
    toggleSortOrder,
    setLayout,
    resetToDefaults,
    clearStorage,
  };
})();

export default viewStore;
