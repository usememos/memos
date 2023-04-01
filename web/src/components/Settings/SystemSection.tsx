import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button, Divider, Input, Switch, Textarea } from "@mui/joy";
import { useGlobalStore } from "@/store/module";
import * as api from "@/helpers/api";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import "@/less/settings/system-section.less";

interface State {
  dbSize: number;
  allowSignUp: boolean;
  disablePublicMemos: boolean;
  additionalStyle: string;
  additionalScript: string;
}

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 Bytes";
  const k = 1024,
    dm = 2,
    sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
};

const SystemSection = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const systemStatus = globalStore.state.systemStatus;
  const [state, setState] = useState<State>({
    dbSize: systemStatus.dbSize,
    allowSignUp: systemStatus.allowSignUp,
    additionalStyle: systemStatus.additionalStyle,
    additionalScript: systemStatus.additionalScript,
    disablePublicMemos: systemStatus.disablePublicMemos,
  });
  const [openAIConfig, setOpenAIConfig] = useState<OpenAIConfig>({
    key: "",
    host: "",
  });

  useEffect(() => {
    globalStore.fetchSystemStatus();
  }, []);

  useEffect(() => {
    setState({
      ...state,
      dbSize: systemStatus.dbSize,
      allowSignUp: systemStatus.allowSignUp,
      additionalStyle: systemStatus.additionalStyle,
      additionalScript: systemStatus.additionalScript,
      disablePublicMemos: systemStatus.disablePublicMemos,
    });
  }, [systemStatus]);

  useEffect(() => {
    api.getSystemSetting().then(({ data: { data: systemSettings } }) => {
      const openAIConfigSetting = systemSettings.find((setting) => setting.name === "openAIConfig");
      if (openAIConfigSetting) {
        setOpenAIConfig(JSON.parse(openAIConfigSetting.value));
      }
    });
  }, []);

  const handleAllowSignUpChanged = async (value: boolean) => {
    setState({
      ...state,
      allowSignUp: value,
    });
    await api.upsertSystemSetting({
      name: "allowSignUp",
      value: JSON.stringify(value),
    });
  };

  const handleUpdateCustomizedProfileButtonClick = () => {
    showUpdateCustomizedProfileDialog();
  };

  const handleVacuumBtnClick = async () => {
    try {
      await api.vacuumDatabase();
      await globalStore.fetchSystemStatus();
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success(t("message.succeed-vacuum-database"));
  };

  const handleOpenAIConfigKeyChanged = (value: string) => {
    setOpenAIConfig({
      ...openAIConfig,
      key: value,
    });
  };

  const handleSaveOpenAIConfig = async () => {
    try {
      await api.upsertSystemSetting({
        name: "openAIConfig",
        value: JSON.stringify(openAIConfig),
      });
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success("OpenAI Config updated");
  };

  const handleOpenAIConfigHostChanged = (value: string) => {
    setOpenAIConfig({
      ...openAIConfig,
      host: value,
    });
  };

  const handleAdditionalStyleChanged = (value: string) => {
    setState({
      ...state,
      additionalStyle: value,
    });
  };

  const handleSaveAdditionalStyle = async () => {
    try {
      await api.upsertSystemSetting({
        name: "additionalStyle",
        value: JSON.stringify(state.additionalStyle),
      });
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success(t("message.succeed-update-additional-style"));
  };

  const handleAdditionalScriptChanged = (value: string) => {
    setState({
      ...state,
      additionalScript: value,
    });
  };

  const handleSaveAdditionalScript = async () => {
    try {
      await api.upsertSystemSetting({
        name: "additionalScript",
        value: JSON.stringify(state.additionalScript),
      });
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success(t("message.succeed-update-additional-script"));
  };

  const handleDisablePublicMemosChanged = async (value: boolean) => {
    setState({
      ...state,
      disablePublicMemos: value,
    });
    globalStore.setSystemStatus({ disablePublicMemos: value });
    await api.upsertSystemSetting({
      name: "disablePublicMemos",
      value: JSON.stringify(value),
    });
  };

  return (
    <div className="section-container system-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label">
        <div className="normal-text">
          {t("setting.system-section.server-name")}: <span className="font-mono font-bold">{systemStatus.customizedProfile.name}</span>
        </div>
        <Button onClick={handleUpdateCustomizedProfileButtonClick}>{t("common.edit")}</Button>
      </div>
      <div className="form-label">
        <span className="normal-text">
          {t("setting.system-section.database-file-size")}: <span className="font-mono font-bold">{formatBytes(state.dbSize)}</span>
        </span>
        <Button onClick={handleVacuumBtnClick}>{t("common.vacuum")}</Button>
      </div>
      <p className="title-text">{t("common.settings")}</p>
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.allow-user-signup")}</span>
        <Switch checked={state.allowSignUp} onChange={(event) => handleAllowSignUpChanged(event.target.checked)} />
      </div>
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.disable-public-memos")}</span>
        <Switch checked={state.disablePublicMemos} onChange={(event) => handleDisablePublicMemosChanged(event.target.checked)} />
      </div>
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <span className="normal-text">OpenAI API Key</span>
        <Button onClick={handleSaveOpenAIConfig}>{t("common.save")}</Button>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder="OpenAI API Key"
        value={openAIConfig.key}
        onChange={(event) => handleOpenAIConfigKeyChanged(event.target.value)}
      />
      <div className="form-label mt-2">
        <span className="normal-text">OpenAI API Host</span>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder="OpenAI API Host. Default: https://api.openai.com"
        value={openAIConfig.host}
        onChange={(event) => handleOpenAIConfigHostChanged(event.target.value)}
      />
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.additional-style")}</span>
        <Button onClick={handleSaveAdditionalStyle}>{t("common.save")}</Button>
      </div>
      <Textarea
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={2}
        maxRows={4}
        placeholder={t("setting.system-section.additional-style-placeholder")}
        value={state.additionalStyle}
        onChange={(event) => handleAdditionalStyleChanged(event.target.value)}
      />
      <div className="form-label mt-2">
        <span className="normal-text">{t("setting.system-section.additional-script")}</span>
        <Button onClick={handleSaveAdditionalScript}>{t("common.save")}</Button>
      </div>
      <Textarea
        className="w-full"
        color="neutral"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={2}
        maxRows={4}
        placeholder={t("setting.system-section.additional-script-placeholder")}
        value={state.additionalScript}
        onChange={(event) => handleAdditionalScriptChanged(event.target.value)}
      />
    </div>
  );
};

export default SystemSection;
