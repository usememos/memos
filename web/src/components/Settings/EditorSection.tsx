import { Switch } from "@usememos/ui";
import { useAutoFocusMode } from "@/hooks/useAutoFocusMode";
import { useSourceMode } from "@/hooks/useSourceMode";
import { useTranslate } from "@/utils/i18n";
import { SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";

const EditorSection = () => {
  const t = useTranslate();
  const [editorMode, setEditorMode] = useSourceMode();
  const [autoFocusMode, setAutoFocusMode] = useAutoFocusMode();

  return (
    <SettingSection title={t("setting.editor.label")}>
      <SettingList aria-label={t("setting.editor.label")}>
        <SettingListItem label={t("editor.markdown-mode")} description={t("setting.editor.markdown-mode-description")}>
          <Switch
            aria-label={t("editor.markdown-mode")}
            checked={editorMode === "source"}
            onCheckedChange={(checked) => setEditorMode(checked ? "source" : "rich")}
          />
        </SettingListItem>
        <SettingListItem label={t("setting.editor.auto-focus-mode")} description={t("setting.editor.auto-focus-mode-description")}>
          <Switch aria-label={t("setting.editor.auto-focus-mode")} checked={autoFocusMode} onCheckedChange={setAutoFocusMode} />
        </SettingListItem>
      </SettingList>
    </SettingSection>
  );
};

export default EditorSection;
