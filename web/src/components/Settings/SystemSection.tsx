import { Button, Divider, Input, Switch, Textarea, Tooltip } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "@/helpers/api";
import { formatBytes } from "@/helpers/utils";
import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import LearnMore from "../LearnMore";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import "@/less/settings/system-section.less";
import { showCommonDialog } from "../Dialog/CommonDialog";
import showDisablePasswordLoginDialog from "../DisablePasswordLoginDialog";

interface State {
  dbSize: number;
  allowSignUp: boolean;
  disablePasswordLogin: boolean;
  disablePublicMemos: boolean;
  additionalStyle: string;
  additionalScript: string;
  maxUploadSizeMiB: number;
  autoBackupInterval: number;
  memoDisplayWithUpdatedTs: boolean;
}

const SystemSection = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const systemStatus = globalStore.state.systemStatus;
  const [state, setState] = useState<State>({
    dbSize: systemStatus.dbSize,
    allowSignUp: systemStatus.allowSignUp,
    disablePasswordLogin: systemStatus.disablePasswordLogin,
    additionalStyle: systemStatus.additionalStyle,
    additionalScript: systemStatus.additionalScript,
    disablePublicMemos: systemStatus.disablePublicMemos,
    maxUploadSizeMiB: systemStatus.maxUploadSizeMiB,
    autoBackupInterval: systemStatus.autoBackupInterval,
    memoDisplayWithUpdatedTs: systemStatus.memoDisplayWithUpdatedTs,
  });
  const [telegramBotToken, setTelegramBotToken] = useState<string>("");

  useEffect(() => {
    globalStore.fetchSystemStatus();
  }, []);

  useEffect(() => {
    api.getSystemSetting().then(({ data: systemSettings }) => {
      const telegramBotSetting = systemSettings.find((setting) => setting.name === "telegram-bot-token");
      if (telegramBotSetting) {
        setTelegramBotToken(telegramBotSetting.value);
      }
    });
  }, []);

  useEffect(() => {
    setState({
      ...state,
      dbSize: systemStatus.dbSize,
      allowSignUp: systemStatus.allowSignUp,
      disablePasswordLogin: systemStatus.disablePasswordLogin,
      additionalStyle: systemStatus.additionalStyle,
      additionalScript: systemStatus.additionalScript,
      disablePublicMemos: systemStatus.disablePublicMemos,
      maxUploadSizeMiB: systemStatus.maxUploadSizeMiB,
      autoBackupInterval: systemStatus.autoBackupInterval,
      memoDisplayWithUpdatedTs: systemStatus.memoDisplayWithUpdatedTs,
    });
  }, [systemStatus]);

  const handleAllowSignUpChanged = async (value: boolean) => {
    setState({
      ...state,
      allowSignUp: value,
    });
    globalStore.setSystemStatus({ allowSignUp: value });
    await api.upsertSystemSetting({
      name: "allow-signup",
      value: JSON.stringify(value),
    });
  };

  const handleDisablePasswordLoginChanged = async (value: boolean) => {
    if (value) {
      showDisablePasswordLoginDialog();
    } else {
      showCommonDialog({
        title: t("setting.system-section.enable-password-login"),
        content: t("setting.system-section.enable-password-login-warning"),
        style: "warning",
        dialogName: "enable-password-login-dialog",
        onConfirm: async () => {
          setState({ ...state, disablePasswordLogin: value });
          globalStore.setSystemStatus({ disablePasswordLogin: value });
          await api.upsertSystemSetting({
            name: "disable-password-login",
            value: JSON.stringify(value),
          });
        },
      });
    }
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

  const handleTelegramBotTokenChanged = (value: string) => {
    setTelegramBotToken(value);
  };

  const handleSaveTelegramBotToken = async () => {
    try {
      await api.upsertSystemSetting({
        name: "telegram-bot-token",
        value: telegramBotToken,
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
      return;
    }
    toast.success("Telegram Bot Token updated");
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

  const handleMemoDisplayWithUpdatedTs = async (value: boolean) => {
    setState({
      ...state,
      memoDisplayWithUpdatedTs: value,
    });
    globalStore.setSystemStatus({ memoDisplayWithUpdatedTs: value });
    await api.upsertSystemSetting({
      name: "memo-display-with-updated-ts",
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

  const handleAutoBackupIntervalChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    // fixes cursor skipping position on mobile
    event.target.selectionEnd = event.target.value.length;

    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    setState({
      ...state,
      autoBackupInterval: num,
    });
    event.target.value = num.toString();
    globalStore.setSystemStatus({ autoBackupInterval: num });
    await api.upsertSystemSetting({
      name: "auto-backup-interval",
      value: JSON.stringify(num),
    });
  };

  const handleAutoBackupIntervalFocus = (event: React.FocusEvent<HTMLInputElement>) => {
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
        <span className="normal-text">{t("setting.system-section.disable-password-login")}</span>
        <Switch checked={state.disablePasswordLogin} onChange={(event) => handleDisablePasswordLoginChanged(event.target.checked)} />
      </div>
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.disable-public-memos")}</span>
        <Switch checked={state.disablePublicMemos} onChange={(event) => handleDisablePublicMemosChanged(event.target.checked)} />
      </div>
      <div className="form-label">
        <span className="normal-text">{t("setting.system-section.display-with-updated-time")}</span>
        <Switch checked={state.memoDisplayWithUpdatedTs} onChange={(event) => handleMemoDisplayWithUpdatedTs(event.target.checked)} />
      </div>
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.max-upload-size")}</span>
          <Tooltip title={t("setting.system-section.max-upload-size-hint")} placement="top">
            <Icon.HelpCircle className="w-4 h-auto" />
          </Tooltip>
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
      <div className="form-label">
        <div className="flex flex-row items-center">
          <span className="text-sm mr-1">{t("setting.system-section.auto-backup-interval")}</span>
          <Tooltip title={t("setting.system-section.auto-backup-interval-hint")} placement="top">
            <Icon.HelpCircle className="w-4 h-auto" />
          </Tooltip>
        </div>
        <Input
          className="w-16"
          sx={{
            fontFamily: "monospace",
          }}
          defaultValue={state.autoBackupInterval}
          onFocus={handleAutoBackupIntervalFocus}
          onChange={handleAutoBackupIntervalChanged}
        />
      </div>
      <Divider className="!mt-3 !my-4" />
      <div className="form-label">
        <div className="flex flex-row items-center">
          <div className="w-auto flex items-center">
            <span className="text-sm mr-1">{t("setting.system-section.telegram-bot-token")}</span>
            <LearnMore
              url="https://usememos.com/docs/integration/telegram-bot"
              title={t("setting.system-section.telegram-bot-token-description")}
            />
          </div>
        </div>
        <Button onClick={handleSaveTelegramBotToken}>{t("common.save")}</Button>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        placeholder={t("setting.system-section.telegram-bot-token-placeholder")}
        value={telegramBotToken}
        onChange={(event) => handleTelegramBotTokenChanged(event.target.value)}
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
