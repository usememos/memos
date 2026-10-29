import { Switch } from "@/components/ui/switch";
import { useSourceMode } from "@/hooks/useSourceMode";
import { useTranslate } from "@/utils/i18n";
import { SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";

const EditorSection = () => {
  const t = useTranslate();
  const [editorMode, setEditorMode] = useSourceMode();

  return (
    <SettingSection title={t("setting.editor.label")}>
      <SettingList>
        <SettingListItem label={t("editor.markdown-mode")} description={t("setting.editor.markdown-mode-description")}>
          <Switch
            aria-label={t("editor.markdown-mode")}
            checked={editorMode === "source"}
            onCheckedChange={(checked) => setEditorMode(checked ? "source" : "rich")}
          />
        </SettingListItem>
      </SettingList>
    </SettingSection>
  );
};

export default EditorSection;
