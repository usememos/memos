import { useTranslation } from "react-i18next";
import { globalService, userService } from "../../services";
import { useAppSelector } from "../../store";
import { VISIBILITY_SELECTOR_ITEMS } from "../../helpers/consts";
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

const editorFontStyleSelectorItems = [
  {
    text: "Normal",
    value: "normal",
  },
  {
    text: "Mono",
    value: "mono",
  },
];

const mobileEditorStyleSelectorItems = [
  {
    text: "Normal",
    value: "normal",
  },
  {
    text: "Float",
    value: "float",
  },
];

const PreferencesSection = () => {
  const { t } = useTranslation();
  const { setting } = useAppSelector((state) => state.user.user as User);
  const visibilitySelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${item.text.toLowerCase()}`),
    };
  });

  const handleLocaleChanged = async (value: string) => {
    await userService.upsertUserSetting("locale", value);
    globalService.setLocale(value as Locale);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userService.upsertUserSetting("memoVisibility", value);
  };

  const handleEditorFontStyleChanged = async (value: string) => {
    await userService.upsertUserSetting("editorFontStyle", value);
  };

  const handleMobileEditorStyleChanged = async (value: string) => {
    await userService.upsertUserSetting("mobileEditorStyle", value);
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <label className="form-label selector">
        <span className="normal-text">{t("common.language")}</span>
        <Selector className="ml-2 w-32" value={setting.locale} dataSource={localeSelectorItems} handleValueChanged={handleLocaleChanged} />
      </label>
      <p className="title-text">{t("setting.preference")}</p>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-visibility")}</span>
        <Selector
          className="ml-2 w-32"
          value={setting.memoVisibility}
          dataSource={visibilitySelectorItems}
          handleValueChanged={handleDefaultMemoVisibilityChanged}
        />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.editor-font-style")}</span>
        <Selector
          className="ml-2 w-32"
          value={setting.editorFontStyle}
          dataSource={editorFontStyleSelectorItems}
          handleValueChanged={handleEditorFontStyleChanged}
        />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.mobile-editor-style")}</span>
        <Selector
          className="ml-2 w-32"
          value={setting.mobileEditorStyle}
          dataSource={mobileEditorStyleSelectorItems}
          handleValueChanged={handleMobileEditorStyleChanged}
        />
      </label>
    </div>
  );
};

export default PreferencesSection;
