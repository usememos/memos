import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { confirmEncryptedDiscard } from "@/lib/e2ee/dirty";
import { VaultSession } from "@/lib/e2ee/session";
import { toast } from "@/lib/toast";
import { useTranslate } from "@/utils/i18n";

const VaultContext = createContext<VaultSession | undefined>(undefined);
const emptySession = new VaultSession();
/** Owns the ephemeral vault session and applies account, inactivity, and cross-tab locks. */
export function E2EEProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [session] = useState(() => new VaultSession());
  const t = useTranslate();
  const tRef = useRef(t);
  useLayoutEffect(() => {
    tRef.current = t;
  }, [t]);
  useLayoutEffect(() => {
    session.setOwner(currentUser?.name ?? "");
  }, [session, currentUser?.name]);
  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("memos-e2ee-lock") : undefined;
    const onLock = () => {
      session.lock();
      channel?.postMessage("lock");
    };
    if (channel) channel.onmessage = () => session.lock();
    window.addEventListener("memos-e2ee-lock", onLock);
    let lastActivity = Date.now();
    let warned = false;
    const activity = () => {
      lastActivity = Date.now();
      warned = false;
    };
    // Check before resetting activity on return from a suspended tab.
    const check = () => {
      if (!session.getSnapshot().key) {
        activity();
        return;
      }
      const idle = Date.now() - lastActivity;
      if (idle >= 15 * 60 * 1000) {
        onLock();
        activity();
      } else if (idle >= 14 * 60 * 1000 && !warned) {
        warned = true;
        toast.add({ title: tRef.current("e2ee.idle-warning"), timeout: 60000 });
      }
    };
    const active = () => {
      check();
      activity();
    };
    for (const event of ["keydown", "pointerdown"]) window.addEventListener(event, active);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 1000);
    return () => {
      clearInterval(timer);
      channel?.close();
      session.lock();
      window.removeEventListener("memos-e2ee-lock", onLock);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      for (const event of ["keydown", "pointerdown"]) window.removeEventListener(event, active);
    };
  }, [session]);
  return <VaultContext.Provider value={session}>{children}</VaultContext.Provider>;
}
/** Subscribes to the current vault state without persisting unwrapped keys. */
export function useVaultSession() {
  const session = useContext(VaultContext) ?? emptySession;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { session, ...snapshot };
}
/** Locks all local editors after confirming disposal of dirty encrypted drafts. */
export function lockEncryption(discardMessage: string) {
  if (!confirmEncryptedDiscard(discardMessage)) return;
  window.dispatchEvent(new Event("memos-e2ee-lock"));
}
