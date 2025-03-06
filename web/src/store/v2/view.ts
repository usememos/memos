import { makeAutoObservable } from "mobx";

const LOCAL_STORAGE_KEY = "memos-view-setting";

class LocalState {
  orderByTimeAsc: boolean = false;
  layout: "LIST" | "MASONRY" = "LIST";

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this));
  }
}

const viewStore = (() => {
  const state = new LocalState();

  return {
    state,
  };
})();

// Initial state from localStorage.
(async () => {
  const localCache = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!localCache) {
    return;
  }

  try {
    const cache = JSON.parse(localCache);
    if (Object.hasOwn(cache, "orderByTimeAsc")) {
      viewStore.state.setPartial({ orderByTimeAsc: Boolean(cache.orderByTimeAsc) });
    }
    if (Object.hasOwn(cache, "layout")) {
      if (["LIST", "MASONRY"].includes(cache.layout)) {
        viewStore.state.setPartial({ layout: cache.layout });
      }
    }
  } catch {
    // Do nothing
  }
})();

export default viewStore;
