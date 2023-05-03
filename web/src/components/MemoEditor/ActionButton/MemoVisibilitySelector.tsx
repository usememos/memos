import { toLower } from "lodash-es";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { useEditorStore, useGlobalStore } from "@/store/module";
import Selector from "@/components/kit/Selector";

const MemoVisibilitySelector = () => {
  const { t } = useTranslation();
  const editorStore = useEditorStore();
  const {
    state: { systemStatus },
  } = useGlobalStore();
  const editorState = editorStore.state;
  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value)}`),
    };
  });

  useEffect(() => {
    if (systemStatus.disablePublicMemos) {
      editorStore.setMemoVisibility("PRIVATE");
    }
  }, [systemStatus.disablePublicMemos]);

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    editorStore.setMemoVisibility(visibilityValue);
  };

  return (
    <Selector
      className="visibility-selector"
      disabled={systemStatus.disablePublicMemos}
      tooltipTitle={t("memo.visibility.disabled")}
      value={editorState.memoVisibility}
      dataSource={memoVisibilityOptionSelectorItems}
      handleValueChanged={handleMemoVisibilityOptionChanged}
    />
  );
};

export default MemoVisibilitySelector;
