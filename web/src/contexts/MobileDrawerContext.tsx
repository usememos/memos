import { createContext, useContext, useState, type ReactNode } from "react";

interface MobileDrawerContextValue {
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const MobileDrawerContext = createContext<MobileDrawerContextValue>({
  isDrawerOpen: false,
  setDrawerOpen: () => {},
});

export function MobileDrawerProvider({ children }: { children: ReactNode }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  return <MobileDrawerContext.Provider value={{ isDrawerOpen, setDrawerOpen }}>{children}</MobileDrawerContext.Provider>;
}

export function useMobileDrawer() {
  return useContext(MobileDrawerContext);
}
