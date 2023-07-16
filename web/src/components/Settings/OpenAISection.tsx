import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { Button, Input } from "@mui/joy";
import { useGlobalStore } from "@/store/module";
import * as api from "@/helpers/api";
import LearnMore from "../LearnMore";
import "@/less/settings/system-section.less";

interface OpenAIConfig {
  key: string;
  host: string;
}

const OpenAISection = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const [openAIConfig, setOpenAIConfig] = useState<OpenAIConfig>({
    key: "",
    host: "",
  });

  useEffect(() => {
    globalStore.fetchSystemStatus();
  }, []);

  useEffect(() => {
    api.getSystemSetting().then(({ data: systemSettings }) => {
      const openAIConfigSetting = systemSettings.find((setting) => setting.name === "openai-config");
      if (openAIConfigSetting) {
        setOpenAIConfig(JSON.parse(openAIConfigSetting.value));
      }
    });
  }, []);

  const handleOpenAIConfigKeyChanged = (value: string) => {
    setOpenAIConfig({
      ...openAIConfig,
      key: value,
    });
  };

  const handleOpenAIConfigHostChanged = (value: string) => {
    setOpenAIConfig({
      ...openAIConfig,
      host: value,
    });
  };

  const handleSaveOpenAIConfig = async () => {
    try {
      await api.upsertSystemSetting({
        name: "openai-config",
        value: JSON.stringify(openAIConfig),
      });
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success("OpenAI Config updated");
  };

  return (
    <div className="section-container system-section-container">
      <p className="title-text">{t("setting.openai")}</p>
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.openai-api-key")}</span>
          <LearnMore title={t("setting.system-section.openai-api-key-description")} url="https://platform.openai.com/account/api-keys" />
        </div>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder={t("setting.system-section.openai-api-key-placeholder")}
        value={openAIConfig.key}
        onChange={(event) => handleOpenAIConfigKeyChanged(event.target.value)}
      />
      <div className="form-label mt-2">
        <span className="normal-text">{t("setting.system-section.openai-api-host")}</span>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder={t("setting.system-section.openai-api-host-placeholder")}
        value={openAIConfig.host}
        onChange={(event) => handleOpenAIConfigHostChanged(event.target.value)}
      />
      <div className="mt-4">
        <Button onClick={handleSaveOpenAIConfig}>{t("common.save")}</Button>
      </div>
    </div>
  );
};

export default OpenAISection;
