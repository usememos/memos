import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Switch from "@mui/joy/Switch";
import * as api from "../../helpers/api";
import { globalService, userService } from "../../services";
import Selector from "../common/Selector";
import "../../less/settings/preferences-section.less";

const localeSelectorItems = [
  {
    text: "English",
    value: "en",
  },
  {
    text: "中文",
    value: "zh",
  },
  {
    text: "Tiếng Việt",
    value: "vi",
  },
];

interface State {
  allowSignUp: boolean;
}

const SystemSection = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({
    allowSignUp: false,
  });

  useEffect(() => {
    api.getSystemStatus().then(({ data }) => {
      const { data: status } = data;
      setState({
        allowSignUp: status.allowSignUp,
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

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <label className="form-label selector">
        <span className="normal-text">Allow user signUp</span>
        <Switch size="sm" checked={state.allowSignUp} onChange={(event) => handleAllowSignUpChanged(event.target.checked)} />
      </label>
    </div>
  );
};

export default SystemSection;
