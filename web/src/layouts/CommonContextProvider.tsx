import { useEffect, useState } from "react";
import { initialGlobalState } from "@/store/module";
import { useUserStore, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v2/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import gomarkWasm from "../assets/gomark.wasm?url";

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

    const loadWasm = async () => {
      const workspaceGeneralSetting =
        workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_GENERAL).generalSetting ||
        WorkspaceGeneralSetting.fromPartial({});

      if (!workspaceGeneralSetting.serverSideMarkdown) {
        // @ts-expect-error codegen
        await import("../assets/wasm_exec.js");

        const go = new window.Go();
        const responsePromise = fetch(gomarkWasm);
        const { instance } = await WebAssembly.instantiateStreaming(responsePromise, go.importObject);

        go.run(instance);
      } else {
        return Promise.resolve();
      }
    };

    (async () => {
      await initialState();
      await loadWasm();

      setLoading(false);
    })();
  }, []);

  return loading ? null : <>{props.children}</>;
};

export default CommonContextProvider;
