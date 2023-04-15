import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button, Divider, Input, Switch, Textarea, Typography } from "@mui/joy";
import { formatBytes } from "@/helpers/utils";
import { useGlobalStore } from "@/store/module";
import * as api from "@/helpers/api";
import Icon from "../Icon";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import "@/less/settings/system-section.less";

interface State {
  dbSize: number;
  allowSignUp: boolean;
  ignoreUpgrade: boolean;
  disablePublicMemos: boolean;
  additionalStyle: string;
  additionalScript: string;
  openAIConfig: OpenAIConfig;
}

const SystemSection = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const systemStatus = globalStore.state.systemStatus;
  const [state, setState] = useState<State>({
    dbSize: systemStatus.dbSize,
    allowSignUp: systemStatus.allowSignUp,
    ignoreUpgrade: systemStatus.ignoreUpgrade,
    additionalStyle: systemStatus.additionalStyle,
    additionalScript: systemStatus.additionalScript,
    disablePublicMemos: systemStatus.disablePublicMemos,
    openAIConfig: systemStatus.openAIConfig,
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
      openAIConfig: systemStatus.openAIConfig,
    });
  }, [systemStatus]);

  const handleAllowSignUpChanged = async (value: boolean) => {
    setState({
      ...state,
      allowSignUp: value,
    });
    await api.upsertSystemSetting({
      name: "allow-signup",
      value: JSON.stringify(value),
    });
  };

  const handleIgnoreUpgradeChanged = async (value: boolean) => {
    setState({
      ...state,
      ignoreUpgrade: value,
    });
    await api.upsertSystemSetting({
      name: "ignore-upgrade",
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
    setState({
      ...state,
      openAIConfig: {
        ...state.openAIConfig,
        key: value,
      },
    });
  };

  const handleSaveOpenAIConfig = async () => {
    try {
      await api.upsertSystemSetting({
        name: "openai-config",
        value: JSON.stringify(state.openAIConfig),
      });
      globalStore.setSystemStatus({ openAIConfig: state.openAIConfig });
    } catch (error) {
      console.error(error);
      return;
    }
    toast.success("OpenAI Config updated");
  };

  const handleOpenAIConfigHostChanged = (value: string) => {
    setState({
      ...state,
      openAIConfig: {
        ...state.openAIConfig,
        host: value,
      },
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
        name: "additional-style",
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
        name: "additional-script",
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
      name: "disable-public-memos",
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
        <span className="normal-text">{t("setting.system-section.ignore-version-upgrade")}</span>
        <Switch checked={state.ignoreUpgrade} onChange={(event) => handleIgnoreUpgradeChanged(event.target.checked)} />
      </div>
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.disable-public-memos")}</span>
        <Switch checked={state.disablePublicMemos} onChange={(event) => handleDisablePublicMemosChanged(event.target.checked)} />
      </div>
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.openai-api-key")}</span>
        <Typography className="!mb-1" level="body2">
          <a
            className="ml-2 text-sm text-blue-600 hover:opacity-80 hover:underline"
            href="https://platform.openai.com/account/api-keys"
            target="_blank"
          >
            {t("setting.system-section.openai-api-key-description")}
            <Icon.ExternalLink className="inline -mt-1 ml-1 w-4 h-auto opacity-80" />
          </a>
        </Typography>
        <Button onClick={handleSaveOpenAIConfig}>{t("common.save")}</Button>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder={t("setting.system-section.openai-api-key-placeholder")}
        value={state.openAIConfig.key}
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
        value={state.openAIConfig.host}
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
