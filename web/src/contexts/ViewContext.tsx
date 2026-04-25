import { createContext, type ReactNode, useContext, useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";

export type MemoSortTimeField = "create_time" | "update_time";

interface ViewState {
  orderByTimeAsc: boolean;
  sortTimeField?: MemoSortTimeField;
}

interface ViewContextValue {
  orderByTimeAsc: boolean;
  sortTimeField: MemoSortTimeField;
  toggleSortOrder: () => void;
  setSortTimeField: (field: MemoSortTimeField) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

const LOCAL_STORAGE_KEY = "memos-view-setting";

export function ViewProvider({ children }: { children: ReactNode }) {
  const { memoRelatedSetting } = useInstance();

  const getInitialState = (): ViewState => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as Partial<ViewState>;
        const sortTimeField = data.sortTimeField === "create_time" || data.sortTimeField === "update_time" ? data.sortTimeField : undefined;
        return {
          orderByTimeAsc: Boolean(data.orderByTimeAsc ?? false),
          sortTimeField,
        };
      }
    } catch (error) {
      console.warn("Failed to load view settings from localStorage:", error);
    }
    return { orderByTimeAsc: false };
  };

  const [viewState, setViewState] = useState(getInitialState);
  const sortTimeField = viewState.sortTimeField ?? (memoRelatedSetting.displayWithUpdateTime ? "update_time" : "create_time");

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

  const setSortTimeField = (field: MemoSortTimeField) => {
    setViewState((prev) => {
      const newState = { ...prev, sortTimeField: field };
      persistToStorage(newState);
      return newState;
    });
  };

  return (
    <ViewContext.Provider
      value={{
        orderByTimeAsc: viewState.orderByTimeAsc,
        sortTimeField,
        toggleSortOrder,
        setSortTimeField,
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
