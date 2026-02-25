import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { instanceServiceClient } from "@/connect";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_AIConfigSetting,
  InstanceSetting_AIConfigSettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const AISection = () => {
  const t = useTranslate();
  const [aiConfig, setAIConfig] = useState<InstanceSetting_AIConfigSetting>(create(InstanceSetting_AIConfigSettingSchema, {}));
  const [originalConfig, setOriginalConfig] = useState<InstanceSetting_AIConfigSetting>(create(InstanceSetting_AIConfigSettingSchema, {}));

  useEffect(() => {
    fetchAIConfig();
  }, []);

  const fetchAIConfig = async () => {
    try {
      const setting = await instanceServiceClient.getInstanceSetting({
        name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.AI_CONFIG]}`,
      });
      if (setting.value.case === "aiConfigSetting") {
        setAIConfig(setting.value.value);
        setOriginalConfig(setting.value.value);
      }
    } catch {
      // AI config not set yet, use defaults
    }
  };

  const allowSave = useMemo(() => {
    return !isEqual(aiConfig, originalConfig);
  }, [aiConfig, originalConfig]);

  const updatePartialConfig = (partial: Partial<InstanceSetting_AIConfigSetting>) => {
    setAIConfig(
      create(InstanceSetting_AIConfigSettingSchema, {
        ...aiConfig,
        ...partial,
      }),
    );
  };

  const handleSave = async () => {
    try {
      await instanceServiceClient.updateInstanceSetting({
        setting: create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.AI_CONFIG]}`,
          value: {
            case: "aiConfigSetting",
            value: aiConfig,
          },
        }),
      });
      setOriginalConfig(aiConfig);
      toast.success(t("message.update-succeed"));
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Update AI settings",
      });
    }
  };

  return (
    <SettingSection>
      <SettingGroup title="AI Configuration">
        <SettingRow label="Enabled">
          <Switch checked={aiConfig.enabled} onCheckedChange={(checked) => updatePartialConfig({ enabled: checked })} />
        </SettingRow>

        <SettingRow label="API Key">
          <Input
            className="w-64"
            type="password"
            value={aiConfig.apiKey}
            onChange={(event) => updatePartialConfig({ apiKey: event.target.value })}
          />
        </SettingRow>

        <SettingRow label="API Base URL">
          <Input
            className="w-64"
            placeholder="https://api.openai.com/v1"
            value={aiConfig.apiBaseUrl}
            onChange={(event) => updatePartialConfig({ apiBaseUrl: event.target.value })}
          />
        </SettingRow>

        <SettingRow label="Model">
          <Input
            className="w-64"
            placeholder="gpt-4o"
            value={aiConfig.model}
            onChange={(event) => updatePartialConfig({ model: event.target.value })}
          />
        </SettingRow>
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!allowSave} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default AISection;
