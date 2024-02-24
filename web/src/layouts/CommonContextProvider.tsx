import { useEffect, useState } from "react";
import { initialGlobalState } from "@/store/module";
import { useUserStore, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";

interface Props {
  children: React.ReactNode;
}

const CommonContextProvider = (props: Props) => {
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialState = async () => {
      await initialGlobalState();
      await workspaceSettingStore.fetchWorkspaceSetting(WorkspaceSettingKey.WORKSPACE_SETTING_GENERAL);
      try {
        await userStore.fetchCurrentUser();
      } catch (error) {
        // Do nothing.
      }
    };

    Promise.all([initialState()]).then(() => setLoading(false));
  }, []);

  return loading ? null : <>{props.children}</>;
};

export default CommonContextProvider;
