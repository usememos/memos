import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import { InstanceSetting, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";

interface SaveInstanceSettingOptions {
  key: InstanceSetting_Key;
  setting: InstanceSetting;
  errorContext: string;
}

export const buildInstanceSettingName = (key: InstanceSetting_Key) => `instance/settings/${InstanceSetting_Key[key]}`;

const useInstanceSettingUpdater = () => {
  const t = useTranslate();
  const { updateSetting, fetchSetting } = useInstance();

  return useCallback(
    async ({ key, setting, errorContext }: SaveInstanceSettingOptions) => {
      try {
        await updateSetting(setting);
        await fetchSetting(key);
        toast.success(t("message.update-succeed"));
        return true;
      } catch (error: unknown) {
        await handleError(error, toast.error, { context: errorContext });
        return false;
      }
    },
    [fetchSetting, t, updateSetting],
  );
};

export default useInstanceSettingUpdater;
