import { createContext, type ReactNode, useContext, useState } from "react";

export type LayoutMode = "LIST" | "MASONRY";

interface ViewContextValue {
  orderByTimeAsc: boolean;
  layout: LayoutMode;
  toggleSortOrder: () => void;
  setLayout: (layout: LayoutMode) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

const LOCAL_STORAGE_KEY = "memos-view-setting";

export function ViewProvider({ children }: { children: ReactNode }) {
  // Load initial state from localStorage
  const getInitialState = () => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          orderByTimeAsc: Boolean(data.orderByTimeAsc ?? false),
          layout: (["LIST", "MASONRY"].includes(data.layout) ? data.layout : "LIST") as LayoutMode,
        };
      }
    } catch (error) {
      console.warn("Failed to load view settings from localStorage:", error);
    }
    return { orderByTimeAsc: false, layout: "LIST" as LayoutMode };
  };

  const [viewState, setViewState] = useState(getInitialState);

  const persistToStorage = (newState: typeof viewState) => {
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

  const setLayout = (layout: LayoutMode) => {
    setViewState((prev) => {
      const newState = { ...prev, layout };
      persistToStorage(newState);
      return newState;
    });
  };

  return (
    <ViewContext.Provider
      value={{
        ...viewState,
        toggleSortOrder,
        setLayout,
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
