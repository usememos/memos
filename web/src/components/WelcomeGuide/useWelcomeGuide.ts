import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserStats } from "@/hooks/useUserQueries";

/** How long after an account is created the guide may still open on its own. */
const WELCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const dismissalKey = (userName: string) => `memos-welcome-guide-dismissed:${userName}`;

const readDismissed = (userName: string) => {
  try {
    return localStorage.getItem(dismissalKey(userName)) === "1";
  } catch {
    return false;
  }
};

const writeDismissed = (userName: string) => {
  try {
    localStorage.setItem(dismissalKey(userName), "1");
  } catch {
    // Private windows and blocked storage: the guide may show once more in this browser.
  }
};

/**
 * When the welcome guide opens on its own: on the account's own Home, while the account
 * has no memos and is younger than a week, and not after it was closed in this browser.
 * Nothing is stored on the server; an import done before the first visit skips it
 * because the memos already exist.
 */
export function useWelcomeGuide(onOwnHome: boolean) {
  const { currentUser, isUserSettingsInitialized } = useAuth();
  const { data: stats } = useUserStats(currentUser?.name, { enabled: Boolean(currentUser) && onOwnHome });
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const createdAt = currentUser?.createTime ? timestampDate(currentUser.createTime).getTime() : undefined;
  const eligible =
    onOwnHome &&
    isUserSettingsInitialized &&
    currentUser !== undefined &&
    createdAt !== undefined &&
    Date.now() - createdAt < WELCOME_WINDOW_MS &&
    stats !== undefined &&
    stats.totalMemoCount === 0 &&
    !readDismissed(currentUser.name);

  useEffect(() => {
    if (eligible && !dismissed) setOpen(true);
  }, [eligible, dismissed]);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen || !currentUser) return;
    setDismissed(true);
    writeDismissed(currentUser.name);
  };

  /** Opens the guide regardless of the rule, for the empty timeline's link. */
  const show = () => setOpen(true);

  return { open, onOpenChange, show };
}
