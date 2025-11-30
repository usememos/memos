import { useCallback, useState } from "react";

export function useDialog(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setOpen: setIsOpen,
  };
}

export function useDialogs() {
  const [openDialogs, setOpenDialogs] = useState<Set<string>>(new Set());

  const isOpen = useCallback((key: string) => openDialogs.has(key), [openDialogs]);

  const open = useCallback((key: string) => {
    setOpenDialogs((prev) => new Set([...prev, key]));
  }, []);

  const close = useCallback((key: string) => {
    setOpenDialogs((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const toggle = useCallback((key: string) => {
    setOpenDialogs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const setOpen = useCallback((key: string, open: boolean) => {
    if (open) {
      setOpenDialogs((prev) => new Set([...prev, key]));
    } else {
      setOpenDialogs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const closeAll = useCallback(() => {
    setOpenDialogs(new Set());
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setOpen,
    closeAll,
    openDialogs: Array.from(openDialogs),
  };
}

export default useDialog;
