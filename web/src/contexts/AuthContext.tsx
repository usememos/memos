import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";
import type { Shortcut } from "@/types/proto/api/v1/shortcut_service_pb";
import type {
  User,
  UserSetting_GeneralSetting,
  UserSetting_TagsSetting,
  UserSetting_WebhooksSetting,
} from "@/types/proto/api/v1/user_service_pb";

interface AuthState {
  currentUser: User | undefined;
  userGeneralSetting: UserSetting_GeneralSetting | undefined;
  userWebhooksSetting: UserSetting_WebhooksSetting | undefined;
  userTagsSetting: UserSetting_TagsSetting | undefined;
  shortcuts: Shortcut[];
  isInitialized: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  refetchSettings: () => Promise<void>;
  setCurrentUser: (user: User | undefined) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_STATE: AuthState = {
  currentUser: undefined,
  userGeneralSetting: undefined,
  userWebhooksSetting: undefined,
  userTagsSetting: undefined,
  shortcuts: [],
  isInitialized: true,
  isLoading: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, isInitialized: false, isLoading: true });

  const fetchUserSettings = useCallback(async (userName: string) => {
    const [{ settings }, { shortcuts }] = await Promise.all([
      userServiceClient.listUserSettings({ parent: userName }),
      shortcutServiceClient.listShortcuts({ parent: userName }),
    ]);

    const generalSetting = settings.find((s) => s.value.case === "generalSetting");
    const webhooksSetting = settings.find((s) => s.value.case === "webhooksSetting");
    const tagsSetting = settings.find((s) => s.value.case === "tagsSetting");

    return {
      userGeneralSetting: generalSetting?.value.case === "generalSetting" ? generalSetting.value.value : undefined,
      userWebhooksSetting: webhooksSetting?.value.case === "webhooksSetting" ? webhooksSetting.value.value : undefined,
      userTagsSetting: tagsSetting?.value.case === "tagsSetting" ? tagsSetting.value.value : undefined,
      shortcuts,
    };
  }, []);

  // Cloudflare Access handles authentication before the request reaches the
  // server. GetCurrentUser resolves the user from the Access session; an
  // Unauthenticated error means we're on a public (bypassed) path.
  const initialize = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const { user: currentUser } = await authServiceClient.getCurrentUser({});
      if (!currentUser) {
        setState(EMPTY_STATE);
        return;
      }
      const settings = await fetchUserSettings(currentUser.name);
      setState({
        currentUser,
        ...settings,
        isInitialized: true,
        isLoading: false,
      });
      queryClient.setQueryData(userKeys.currentUser(), currentUser);
      queryClient.setQueryData(userKeys.detail(currentUser.name), currentUser);
    } catch {
      // Anonymous visitor on a public path — not an error.
      setState(EMPTY_STATE);
    }
  }, [fetchUserSettings, queryClient]);

  // Sign-out is a Cloudflare Access concern: clear local state and hit the
  // Access logout endpoint, which revokes the CF_Authorization cookie.
  const logout = useCallback(async () => {
    queryClient.clear();
    window.location.href = "/cdn-cgi/access/logout";
  }, [queryClient]);

  const refetchSettings = useCallback(async () => {
    const currentUserName = state.currentUser?.name;
    if (!currentUserName) {
      return;
    }

    const settings = await fetchUserSettings(currentUserName);
    setState((prev) => {
      if (prev.currentUser?.name !== currentUserName) {
        return prev;
      }
      return { ...prev, ...settings };
    });
  }, [fetchUserSettings, state.currentUser?.name]);

  // Sync the updated user to AuthContext and React Query cache after profile changes
  const setCurrentUser = useCallback(
    (user: User | undefined) => {
      const previousUser = queryClient.getQueryData<User>(userKeys.currentUser());
      setState((prev) => ({ ...prev, currentUser: user }));
      if (user) {
        queryClient.setQueryData(userKeys.currentUser(), user);
        queryClient.setQueryData(userKeys.detail(user.name), user);
      } else {
        queryClient.removeQueries({ queryKey: userKeys.currentUser(), exact: true });
        if (previousUser?.name) {
          queryClient.removeQueries({ queryKey: userKeys.detail(previousUser.name), exact: true });
        }
      }
    },
    [queryClient],
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      ...state,
      initialize,
      logout,
      refetchSettings,
      setCurrentUser,
    }),
    [state, initialize, logout, refetchSettings, setCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Convenience hook for just the current user
export function useCurrentUserFromAuth() {
  const { currentUser } = useAuth();
  return currentUser;
}
