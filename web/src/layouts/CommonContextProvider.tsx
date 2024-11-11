import { createContext, useContext, useEffect, useState } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { workspaceServiceClient } from "@/grpcweb";
import { useUserStore, useWorkspaceSettingStore } from "@/store/v1";
import { useNestStore } from "@/store/v1/nest";
import { Nest } from "@/types/proto/api/v1/nest_service";
import { WorkspaceProfile } from "@/types/proto/api/v1/workspace_service";
import { WorkspaceGeneralSetting, WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";

interface Context {
  locale: string;
  appearance: string;
  profile: WorkspaceProfile;
  nest: Nest;
  setLocale: (locale: string) => void;
  setAppearance: (appearance: string) => void;
  setNest: (nest: Nest) => void;
}

const CommonContext = createContext<Context>({
  locale: "en",
  appearance: "system",
  profile: WorkspaceProfile.fromPartial({}),
  nest: Nest.fromPartial({}),
  setLocale: () => {},
  setAppearance: () => {},
  setNest: () => {},
});

const CommonContextProvider = ({ children }: { children: React.ReactNode }) => {
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const nestStore = useNestStore();
  const [initialized, setInitialized] = useState(false);
  const [commonContext, setCommonContext] = useState<Pick<Context, "locale" | "appearance" | "profile" | "nest">>({
    locale: "en",
    appearance: "system",
    nest: Nest.fromPartial({}),
    profile: WorkspaceProfile.fromPartial({}),
  });
  const [locale] = useLocalStorage("locale", "en");
  const [appearance] = useLocalStorage("appearance", "system");
  const [nest] = useLocalStorage("nest", "");

  useEffect(() => {
    const initialWorkspace = async () => {
      const workspaceProfile = await workspaceServiceClient.getWorkspaceProfile({});
      const nests = await nestStore.fetchNests();
      // Initial fetch for workspace settings.
      (async () => {
        [WorkspaceSettingKey.GENERAL, WorkspaceSettingKey.MEMO_RELATED].forEach(async (key) => {
          await workspaceSettingStore.fetchWorkspaceSetting(key);
        });
      })();

      const workspaceGeneralSetting =
        workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL).generalSetting ||
        WorkspaceGeneralSetting.fromPartial({});
      setCommonContext({
        locale: locale || workspaceGeneralSetting.customProfile?.locale || "en",
        appearance: appearance || workspaceGeneralSetting.customProfile?.appearance || "system",
        nest: Object.entries(nests)[0][1] || nest || "",
        profile: workspaceProfile,
      });
    };

    const initialUser = async () => {
      try {
        await userStore.fetchCurrentUser();
      } catch (error) {
        // Do nothing.
      }
    };

    Promise.all([initialWorkspace(), initialUser()]).then(() => setInitialized(true));
  }, []);

  return (
    <CommonContext.Provider
      value={{
        ...commonContext,
        setLocale: (locale: string) => setCommonContext({ ...commonContext, locale }),
        setAppearance: (appearance: string) => setCommonContext({ ...commonContext, appearance }),
        setNest: (nest: Nest) => setCommonContext({ ...commonContext, nest }),
      }}
    >
      {!initialized ? null : <>{children}</>}
    </CommonContext.Provider>
  );
};

export const useCommonContext = () => {
  return useContext(CommonContext);
};

export default CommonContextProvider;
