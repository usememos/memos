import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch, Textarea } from "@mui/joy";
import * as api from "../../helpers/api";
import toastHelper from "../Toast";
import "../../less/settings/system-section.less";

interface State {
  dbSize: number;
  allowSignUp: boolean;
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
  const [state, setState] = useState<State>({
    dbSize: 0,
    allowSignUp: false,
    additionalStyle: "",
    additionalScript: "",
  });

  useEffect(() => {
    api.getSystemStatus().then(({ data }) => {
      const { data: status } = data;
      setState({
        dbSize: status.dbSize,
        allowSignUp: status.allowSignUp,
        additionalStyle: status.additionalStyle,
        additionalScript: status.additionalScript,
      });
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
    toastHelper.success("Succeed to update additional style");
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
    toastHelper.success("Succeed to update additional script");
  };

  return (
    <div className="section-container system-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <p className="text-value">
        Database File Size: <span className="font-mono font-medium">{formatBytes(state.dbSize)}</span>
      </p>
      <p className="title-text">{t("sidebar.setting")}</p>
      <label className="form-label">
        <span className="normal-text">Allow user signup</span>
        <Switch size="sm" checked={state.allowSignUp} onChange={(event) => handleAllowSignUpChanged(event.target.checked)} />
      </label>
      <div className="form-label">
        <span className="normal-text">Additional style</span>
        <Button size="sm" onClick={handleSaveAdditionalStyle}>
          Save
        </Button>
      </div>
      <Textarea
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={4}
        maxRows={10}
        placeholder="Additional css codes"
        value={state.additionalStyle}
        onChange={(event) => handleAdditionalStyleChanged(event.target.value)}
      />
      <div className="form-label mt-2">
        <span className="normal-text">Additional script</span>
        <Button size="sm" onClick={handleSaveAdditionalScript}>
          Save
        </Button>
      </div>
      <Textarea
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={4}
        maxRows={10}
        placeholder="Additional JavaScript codes"
        value={state.additionalScript}
        onChange={(event) => handleAdditionalScriptChanged(event.target.value)}
      />
    </div>
  );
};

export default SystemSection;
