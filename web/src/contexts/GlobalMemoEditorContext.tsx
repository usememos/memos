import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTranslate } from "@/utils/i18n";

interface GlobalMemoEditorContextValue {
  /** Whether the signed-in user is ready to compose; gates every visible entry point. */
  canOpen: boolean;
  openEditor: () => void;
}

const GlobalMemoEditorContext = createContext<GlobalMemoEditorContextValue | null>(null);

const isVisibleFocusTarget = (element: HTMLElement | null): element is HTMLElement => {
  if (!element?.isConnected || element.tabIndex < 0 || element.matches(":disabled, [aria-disabled='true']")) return false;

  // Walk ancestors: the mobile trigger is hidden by a `md:hidden` parent, which
  // never shows up in the element's own computed style.
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }

  return true;
};

const findVisibleFocusTarget = (selector: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisibleFocusTarget) ?? null;

export function GlobalMemoEditorProvider({ children }: { children: ReactNode }) {
  const t = useTranslate();
  const currentUserName = useCurrentUser()?.name;
  const { isUserSettingsInitialized } = useAuth();
  const { setMobileOpen, setQuickFindOpen } = useAppSidebar();
  // Keyed by the user who opened it, so signing out closes the composer in the
  // same render and a different user signing in cannot resurrect it.
  const [openedFor, setOpenedFor] = useState<string>();
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();
  // Only ever read from event handlers, so a ref keeps each save from
  // re-rendering the provider and the whole editor tree it hosts.
  const isSavingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openRequestVersionRef = useRef(0);

  const closeEditor = useCallback(() => {
    openRequestVersionRef.current += 1;
    isSavingRef.current = false;
    setOpenedFor(undefined);
  }, []);
  const requestCloseEditor = useCallback(() => {
    if (!isSavingRef.current) closeEditor();
  }, [closeEditor]);
  const reportSaving = useCallback((saving: boolean) => {
    isSavingRef.current = saving;
  }, []);

  // The editor reads defaults out of user settings, so composing has to wait for
  // them. Keep the rule here so every entry point uses the same gate.
  const canOpen = Boolean(currentUserName) && isUserSettingsInitialized;

  const openEditor = useCallback(() => {
    if (!canOpen || !currentUserName) return;

    // Owned here so no caller can leave a sidebar surface open underneath.
    setMobileOpen(false);
    setQuickFindOpen(false);

    const requestVersion = ++openRequestVersionRef.current;
    isSavingRef.current = false;
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;

    void loadMemoEditor()
      .then(({ default: MemoEditor }) => {
        if (openRequestVersionRef.current !== requestVersion) return;
        setEditorComponent(() => MemoEditor);
        setOpenedFor(currentUserName);
      })
      .catch(() => undefined);
  }, [canOpen, currentUserName, setMobileOpen, setQuickFindOpen]);

  useEffect(() => {
    // RootLayout remains mounted when a public instance moves from Home to
    // Explore on sign-out. Treat every auth/readiness transition as a session
    // boundary so an open composer—or a pending lazy import—cannot survive it.
    closeEditor();
    returnFocusRef.current = null;
  }, [closeEditor, currentUserName, isUserSettingsInitialized]);

  const resolveFinalFocus = useCallback(() => {
    // Release the remembered node here rather than in closeEditor: base-ui asks
    // for it after close, and a trigger that unmounted with the drawer would
    // otherwise keep its whole detached subtree alive until the next open.
    const remembered = isVisibleFocusTarget(returnFocusRef.current) ? returnFocusRef.current : null;
    returnFocusRef.current = null;

    return remembered ?? findVisibleFocusTarget("[data-new-memo-trigger]") ?? findVisibleFocusTarget("[data-mobile-navigation-trigger]");
  }, []);

  const editorIsOpen = openedFor !== undefined && openedFor === currentUserName;
  const value = useMemo(() => ({ canOpen, openEditor }), [canOpen, openEditor]);

  return (
    <GlobalMemoEditorContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root
        open={editorIsOpen}
        onOpenChange={(open, eventDetails) => {
          if (!open && isSavingRef.current) {
            eventDetails.cancel();
            return;
          }
          if (open) {
            setOpenedFor(currentUserName);
          } else {
            closeEditor();
          }
        }}
      >
        {EditorComponent && (
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-overlay bg-transparent" />
            <DialogPrimitive.Popup
              className="fixed inset-0 z-overlay outline-none"
              initialFocus
              finalFocus={resolveFinalFocus}
              aria-modal="true"
            >
              <VisuallyHidden>
                <DialogPrimitive.Title>{t("editor.new-memo")}</DialogPrimitive.Title>
              </VisuallyHidden>
              <EditorComponent
                autoFocus
                cacheKey="global-memo-editor"
                placeholder={t("editor.any-thoughts")}
                onConfirm={closeEditor}
                onCancel={closeEditor}
                // Hosts the editor's focus-mode presentation: it mounts in focus
                // mode and dismisses this dialog instead of collapsing inline.
                onFocusModeExit={requestCloseEditor}
                onSavingChange={reportSaving}
              />
              <DialogPrimitive.Close className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:end-3 focus-visible:top-3 focus-visible:z-dropdown focus-visible:h-9 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:text-sm focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                {t("common.close")}
              </DialogPrimitive.Close>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        )}
      </DialogPrimitive.Root>
    </GlobalMemoEditorContext.Provider>
  );
}

export function useGlobalMemoEditor() {
  const context = useContext(GlobalMemoEditorContext);
  if (!context) {
    throw new Error("useGlobalMemoEditor must be used within GlobalMemoEditorProvider");
  }
  return context;
}
