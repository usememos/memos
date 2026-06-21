import { createContext, type ReactNode, useContext, useState } from "react";

export type MemoTimeBasis = "create_time" | "update_time";

interface ViewState {
  orderByTimeAsc: boolean;
  timeBasis?: MemoTimeBasis;
  sortTimeField?: MemoTimeBasis;
  compactMode: boolean;
}

interface ViewContextValue {
  orderByTimeAsc: boolean;
  timeBasis: MemoTimeBasis;
  compactMode: boolean;
  toggleSortOrder: () => void;
  setTimeBasis: (field: MemoTimeBasis) => void;
  setCompactMode: (value: boolean) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

const LOCAL_STORAGE_KEY = "memos-view-setting";

export function ViewProvider({ children }: { children: ReactNode }) {
  const getInitialState = (): ViewState => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as Partial<ViewState>;
        const cachedTimeBasis = data.timeBasis ?? data.sortTimeField;
        const timeBasis = cachedTimeBasis === "create_time" || cachedTimeBasis === "update_time" ? cachedTimeBasis : undefined;
        return {
          orderByTimeAsc: Boolean(data.orderByTimeAsc ?? false),
          timeBasis,
          compactMode: Boolean(data.compactMode ?? false),
        };
      }
    } catch (error) {
      console.warn("Failed to load view settings from localStorage:", error);
    }
    return { orderByTimeAsc: false, compactMode: false };
  };

  const [viewState, setViewState] = useState(getInitialState);
  const timeBasis = viewState.timeBasis ?? "create_time";

  const persistToStorage = (newState: ViewState) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.warn("Failed to persist view settings:", error);
    }
  };

  const toggleSortOrder = () => {
    setViewState((prev) => {
      const newState = { ...prev, orderByTimeAsc: !prev.orderByTimeAsc };
      persistToStorage(newState);
      return newState;
    });
  };

  const setTimeBasis = (field: MemoTimeBasis) => {
    setViewState((prev) => {
      const newState = { ...prev, timeBasis: field };
      persistToStorage(newState);
      return newState;
    });
  };

  const setCompactMode = (value: boolean) => {
    setViewState((prev) => {
      const newState = { ...prev, compactMode: value };
      persistToStorage(newState);
      return newState;
    });
  };

  return (
    <ViewContext.Provider
      value={{
        orderByTimeAsc: viewState.orderByTimeAsc,
        timeBasis,
        compactMode: viewState.compactMode,
        toggleSortOrder,
        setTimeBasis,
        setCompactMode,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useView must be used within ViewProvider");
  }
  return context;
}
