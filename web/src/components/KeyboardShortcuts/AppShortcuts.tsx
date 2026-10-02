import { useLocation, useNavigate } from "react-router-dom";
import { focusEditorIn } from "@/components/MemoEditor/focus";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useKeyboardShortcutsContext } from "@/contexts/KeyboardShortcutsContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { collectionNavigationPath, getShortcutCollectionPath, ROUTES } from "@/router/routes";

/** Registers the shortcuts that work on every page: compose, search, filters, and go-to navigation. */
const AppShortcuts = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { canOpen, openEditor } = useGlobalMemoEditor();
  const { setQuickFindOpen } = useAppSidebar();
  const { openHelp } = useKeyboardShortcutsContext();
  const { hasActiveFilters, clearAllFilters } = useMemoFilterContext();
  // Collection destinations retain the current Space; Home and Explore choose their named creator scope.
  const goToCollection = (pathname: string) => () => navigate(collectionNavigationPath(pathname, location, currentUser?.username));
  const goTo = (pathname: string) => () => navigate(pathname);
  const signedIn = Boolean(currentUser);

  useKeyboardShortcuts({
    "memo.new": canOpen ? openEditor : undefined,
    // Focus the page's inline composer if it has one, otherwise open the global one.
    "editor.focus": canOpen ? () => focusEditorIn(document.querySelector("[data-memo-composer]")) || openEditor() : undefined,
    "search.open": () => setQuickFindOpen(true),
    "filters.clear": hasActiveFilters ? clearAllFilters : undefined,
    "help.open": openHelp,
    // The router numbers its history entries from 0, so only go back to a page inside the app.
    // Read at key press: React Compiler would cache a render-time read of window.history.
    "go.back": () => {
      if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    },
    "go.home": goTo(getShortcutCollectionPath("home", location, currentUser?.username)),
    "go.explore": goTo(getShortcutCollectionPath("explore", location, currentUser?.username)),
    "go.calendar": goToCollection(ROUTES.CALENDAR),
    "go.map": goToCollection(ROUTES.MAP),
    "go.attachments": signedIn ? goToCollection(ROUTES.ATTACHMENTS) : undefined,
    "go.archived": signedIn ? goTo(ROUTES.ARCHIVED) : undefined,
    "go.inbox": signedIn ? goTo(ROUTES.INBOX) : undefined,
    "go.settings": signedIn ? goTo(ROUTES.SETTING) : undefined,
  });

  return null;
};

export default AppShortcuts;
