import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button, Divider, Input, Switch, Textarea } from "@mui/joy";
import { formatBytes } from "@/helpers/utils";
import { useGlobalStore } from "@/store/module";
import * as api from "@/helpers/api";
import HelpButton from "../kit/HelpButton";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import "@/less/settings/system-section.less";

interface State {
  dbSize: number;
  allowSignUp: boolean;
  ignoreUpgrade: boolean;
  disablePublicMemos: boolean;
  additionalStyle: string;
  additionalScript: string;
  maxUploadSizeMiB: number;
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
    maxUploadSizeMiB: systemStatus.maxUploadSizeMiB,
  });
  const [telegramRobotToken, setTelegramRobotToken] = useState<string>("");
  const [openAIConfig, setOpenAIConfig] = useState<OpenAIConfig>({
    key: "",
    host: "",
  });

  useEffect(() => {
    globalStore.fetchSystemStatus();
  }, []);

  useEffect(() => {
    api.getSystemSetting().then(({ data: { data: systemSettings } }) => {
      const openAIConfigSetting = systemSettings.find((setting) => setting.name === "openai-config");
      if (openAIConfigSetting) {
        setOpenAIConfig(JSON.parse(openAIConfigSetting.value));
      }

      const telegramRobotSetting = systemSettings.find((setting) => setting.name === "telegram-robot-token");
      if (telegramRobotSetting) {
        setTelegramRobotToken(telegramRobotSetting.value);
      }
    });
  }, []);

  useEffect(() => {
    setState({
      ...state,
      dbSize: systemStatus.dbSize,
      allowSignUp: systemStatus.allowSignUp,
      additionalStyle: systemStatus.additionalStyle,
      additionalScript: systemStatus.additionalScript,
      disablePublicMemos: systemStatus.disablePublicMemos,
      maxUploadSizeMiB: systemStatus.maxUploadSizeMiB,
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

  const handleTelegramRobotTokenChanged = (value: string) => {
    setTelegramRobotToken(value);
  };

  const handleSaveTelegramRobotToken = async () => {
    try {
      await api.upsertSystemSetting({
        name: "telegram-robot-token",
        value: telegramRobotToken,
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
      return;
    }
    toast.success("OpenAI Config updated");
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

  const handleMaxUploadSizeChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    // fixes cursor skipping position on mobile
    event.target.selectionEnd = event.target.value.length;

    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    setState({
      ...state,
      maxUploadSizeMiB: num,
    });
    event.target.value = num.toString();
    globalStore.setSystemStatus({ maxUploadSizeMiB: num });
    await api.upsertSystemSetting({
      name: "max-upload-size-mib",
      value: JSON.stringify(num),
    });
  };

  const handleMaxUploadSizeFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
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
        <span className="text-sm">
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
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.max-upload-size")}</span>
          <HelpButton icon="info" hint={t("setting.system-section.max-upload-size-hint")} />
        </div>
        <Input
          className="w-16"
          sx={{
            fontFamily: "monospace",
          }}
          defaultValue={state.maxUploadSizeMiB}
          onFocus={handleMaxUploadSizeFocus}
          onChange={handleMaxUploadSizeChanged}
        />
      </div>
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.telegram-robot-token")}</span>
          <HelpButton
            hint={t("setting.system-section.telegram-robot-token-description")}
            url="https://core.telegram.org/bots#how-do-i-create-a-bot"
          />
        </div>
        <Button onClick={handleSaveTelegramRobotToken}>{t("common.save")}</Button>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder={t("setting.system-section.telegram-robot-token-placeholder")}
        value={telegramRobotToken}
        onChange={(event) => handleTelegramRobotTokenChanged(event.target.value)}
      />
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.openai-api-key")}</span>
          <HelpButton hint={t("setting.system-section.openai-api-key-description")} url="https://platform.openai.com/account/api-keys" />
        </div>
        <Button onClick={handleSaveOpenAIConfig}>{t("common.save")}</Button>
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
