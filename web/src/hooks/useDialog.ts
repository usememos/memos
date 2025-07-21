import { useState, useCallback } from "react";

/**
 * Hook for managing dialog state with a clean API
 *
 * @returns Object with dialog state and handlers
 *
 * @example
 * const dialog = useDialog();
 *
 * return (
 *   <>
 *     <Button onClick={dialog.open}>Open Dialog</Button>
 *     <SomeDialog
 *       open={dialog.isOpen}
 *       onOpenChange={dialog.setOpen}
 *       onSuccess={dialog.close}
 *     />
 *   </>
 * );
 */
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

/**
 * Hook for managing multiple dialogs with named keys
 *
 * @returns Object with dialog management functions
 *
 * @example
 * const dialogs = useDialogs();
 *
 * return (
 *   <>
 *     <Button onClick={() => dialogs.open('create')}>Create User</Button>
 *     <Button onClick={() => dialogs.open('edit')}>Edit User</Button>
 *
 *     <CreateUserDialog
 *       open={dialogs.isOpen('create')}
 *       onOpenChange={(open) => dialogs.setOpen('create', open)}
 *     />
 *     <EditUserDialog
 *       open={dialogs.isOpen('edit')}
 *       onOpenChange={(open) => dialogs.setOpen('edit', open)}
 *     />
 *   </>
 * );
 */
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
