import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { clearAccessToken, getAccessToken } from "@/auth-state";
import { authServiceClient, refreshAccessToken, userServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";
import type {
  User,
  UserSetting_EditorSetting,
  UserSetting_GeneralSetting,
  UserSetting_TagsSetting,
  UserSetting_WebhooksSetting,
} from "@/types/proto/api/user_service_pb";

interface AuthState {
  currentUser: User | undefined;
  userGeneralSetting: UserSetting_GeneralSetting | undefined;
  userWebhooksSetting: UserSetting_WebhooksSetting | undefined;
  userTagsSetting: UserSetting_TagsSetting | undefined;
  /** Unset until the user first changes an editor preference. */
  userEditorSetting: UserSetting_EditorSetting | undefined;
  /** Authentication identity has settled, while user settings may still be loading. */
  isIdentityInitialized: boolean;
  /** User settings that affect memo presentation are safe to consume. */
  isUserSettingsInitialized: boolean;
  isInitialized: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  refetchSettings: () => Promise<void>;
  setCurrentUser: (user: User | undefined) => void;
  /** Applies an editor setting locally, ahead of or instead of a refetch. */
  setUserEditorSetting: Dispatch<SetStateAction<UserSetting_EditorSetting | undefined>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Settled auth state for a request with no valid session (init finished, not loading). */
const UNAUTHENTICATED_STATE: AuthState = {
  currentUser: undefined,
  userGeneralSetting: undefined,
  userWebhooksSetting: undefined,
  userTagsSetting: undefined,
  userEditorSetting: undefined,
  isIdentityInitialized: true,
  isUserSettingsInitialized: true,
  isInitialized: true,
  isLoading: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const editorSettingVersion = useRef(0);
  const [state, setState] = useState<AuthState>({
    currentUser: undefined,
    userGeneralSetting: undefined,
    userWebhooksSetting: undefined,
    userTagsSetting: undefined,
    userEditorSetting: undefined,
    isIdentityInitialized: false,
    isUserSettingsInitialized: false,
    isInitialized: false,
    isLoading: true,
  });

  const fetchUserSettings = useCallback(async (userName: string) => {
    const version = editorSettingVersion.current;
    const { userSettings: settings } = await userServiceClient.listUserSettings({ parent: userName });
    const generalSetting = settings.find((s) => s.value.case === "generalSetting");
    const webhooksSetting = settings.find((s) => s.value.case === "webhooksSetting");
    const tagsSetting = settings.find((s) => s.value.case === "tagsSetting");
    const editorSetting = settings.find((s) => s.value.case === "editorSetting");
    const userSettings = {
      userGeneralSetting: generalSetting?.value.case === "generalSetting" ? generalSetting.value.value : undefined,
      userWebhooksSetting: webhooksSetting?.value.case === "webhooksSetting" ? webhooksSetting.value.value : undefined,
      userTagsSetting: tagsSetting?.value.case === "tagsSetting" ? tagsSetting.value.value : undefined,
      userEditorSetting: editorSetting?.value.case === "editorSetting" ? editorSetting.value.value : undefined,
    };

    return { userSettings, version };
  }, []);

  const initialize = useCallback(async () => {
    // `initialize` also runs after sign-in, when the previous unauthenticated
    // state is already marked initialized. Reset the full-readiness flag so
    // consumers cannot render with the new identity and stale/default settings.
    setState((prev) => ({ ...prev, isUserSettingsInitialized: false, isInitialized: false, isLoading: true }));

    // Try to get or refresh the access token.
    // This handles PWA isolated storage scenarios (e.g., iOS Safari) where localStorage
    // may be empty but a valid HTTP-only refresh token cookie still exists.
    // getAccessToken() returns a cached token or loads from localStorage if valid.
    if (!getAccessToken()) {
      try {
        await refreshAccessToken();
      } catch {
        // Refresh failed - no valid session
      }
    }

    // If we still don't have a token after refresh attempt, skip getCurrentUser call
    // to avoid unnecessary network request for unauthenticated users.
    if (!getAccessToken()) {
      setState(UNAUTHENTICATED_STATE);
      return;
    }

    try {
      const { user: currentUser } = await authServiceClient.getCurrentUser({});

      if (!currentUser) {
        clearAccessToken();
        setState(UNAUTHENTICATED_STATE);
        return;
      }

      // Publish the verified identity immediately so route modules and their
      // data queries can start while display-sensitive settings are loading.
      setState((prev) => ({
        ...prev,
        currentUser,
        isIdentityInitialized: true,
      }));

      queryClient.setQueryData(userKeys.currentUser(), currentUser);
      queryClient.setQueryData(userKeys.detail(currentUser.name), currentUser);

      const { userSettings, version } = await fetchUserSettings(currentUser.name);

      setState((prev) => ({
        ...prev,
        currentUser,
        ...userSettings,
        userEditorSetting: version === editorSettingVersion.current ? userSettings.userEditorSetting : prev.userEditorSetting,
        isIdentityInitialized: true,
        isUserSettingsInitialized: true,
        isInitialized: true,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      clearAccessToken();
      setState(UNAUTHENTICATED_STATE);
    }
  }, [fetchUserSettings, queryClient]);

  const logout = useCallback(async () => {
    try {
      await authServiceClient.signOut({});
    } catch (error) {
      console.error("[AuthContext] Failed to sign out:", error);
    } finally {
      clearAccessToken();
      setState(UNAUTHENTICATED_STATE);
      queryClient.clear();
    }
  }, [queryClient]);

  const refetchSettings = useCallback(async () => {
    const currentUserName = state.currentUser?.name;
    if (!currentUserName) {
      return;
    }

    const { userSettings, version } = await fetchUserSettings(currentUserName);
    setState((prev) => {
      if (prev.currentUser?.name !== currentUserName) {
        return prev;
      }
      return {
        ...prev,
        ...userSettings,
        userEditorSetting: version === editorSettingVersion.current ? userSettings.userEditorSetting : prev.userEditorSetting,
        isUserSettingsInitialized: true,
      };
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

  const setUserEditorSetting = useCallback<Dispatch<SetStateAction<UserSetting_EditorSetting | undefined>>>((setting) => {
    editorSettingVersion.current += 1;
    setState((prev) => ({
      ...prev,
      userEditorSetting: typeof setting === "function" ? setting(prev.userEditorSetting) : setting,
    }));
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      ...state,
      initialize,
      logout,
      refetchSettings,
      setCurrentUser,
      setUserEditorSetting,
    }),
    [state, initialize, logout, refetchSettings, setCurrentUser, setUserEditorSetting],
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
