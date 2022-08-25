import { globalService, userService } from "../../services";
import { useAppSelector } from "../../store";
import { VISIBILITY_SELECTOR_ITEMS } from "../../helpers/consts";
import useI18n from "../../hooks/useI18n";
import BetaBadge from "../BetaBadge";
import Selector from "../common/Selector";
import "../../less/settings/preferences-section.less";

interface Props {}

const localeSelectorItems = [
  {
    text: "English",
    value: "en",
  },
  {
    text: "中文",
    value: "zh",
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

const PreferencesSection: React.FC<Props> = () => {
  const { t } = useI18n();
  const { setting } = useAppSelector((state) => state.user.user as User);

  const handleLocaleChanged = async (value: string) => {
    globalService.setLocale(value as Locale);
    await userService.upsertUserSetting("locale", value);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userService.upsertUserSetting("memoVisibility", value);
  };

  const handleEditorFontStyleChanged = async (value: string) => {
    await userService.upsertUserSetting("editorFontStyle", value);
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.language")}</p>
      <label className="form-label selector">
        <span className="normal-text">
          {t("common.language")}: <BetaBadge className="ml-2" />
        </span>
        <Selector className="ml-2 w-28" value={setting.locale} dataSource={localeSelectorItems} handleValueChanged={handleLocaleChanged} />
      </label>
      <p className="title-text">{t("setting.preference")}</p>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-visibility")}:</span>
        <Selector
          className="ml-2 w-32"
          value={setting.memoVisibility}
          dataSource={VISIBILITY_SELECTOR_ITEMS}
          handleValueChanged={handleDefaultMemoVisibilityChanged}
        />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.editor-font-style")}:</span>
        <Selector
          className="ml-2 w-32"
          value={setting.editorFontStyle}
          dataSource={editorFontStyleSelectorItems}
          handleValueChanged={handleEditorFontStyleChanged}
        />
      </label>
    </div>
  );
};

export default PreferencesSection;
