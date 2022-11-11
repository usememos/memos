import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch, Textarea } from "@mui/joy";
import * as api from "../../helpers/api";
import "../../less/settings/preferences-section.less";

interface State {
  allowSignUp: boolean;
  additionalStyle: string;
}

const SystemSection = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({
    allowSignUp: false,
    additionalStyle: "",
  });

  useEffect(() => {
    api.getSystemStatus().then(({ data }) => {
      const { data: status } = data;
      setState({
        allowSignUp: status.allowSignUp,
        additionalStyle: status.additionalStyle,
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
    await api.upsertSystemSetting({
      name: "additionalStyle",
      value: JSON.stringify(state.additionalStyle),
    });
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <label className="form-label selector">
        <span className="normal-text">Allow user signup</span>
        <Switch size="sm" checked={state.allowSignUp} onChange={(event) => handleAllowSignUpChanged(event.target.checked)} />
      </label>
      <label className="form-label selector">
        <span className="normal-text">Additional style</span>
        <Button size="sm" onClick={handleSaveAdditionalStyle}>
          Save
        </Button>
      </label>
      <Textarea
        className="w-full"
        sx={{
          fontFamily: "monospace",
        }}
        minRows={5}
        defaultValue={state.additionalStyle}
        onChange={(event) => handleAdditionalStyleChanged(event.target.value)}
      />
    </div>
  );
};

export default SystemSection;
