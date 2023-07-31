import { toLower } from "lodash-es";
import Selector from "@/components/kit/Selector";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

interface Props {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

const MemoVisibilitySelector = (props: Props) => {
  const { value, onChange } = props;
  const t = useTranslate();
  const {
    state: { systemStatus },
  } = useGlobalStore();
  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value) as Lowercase<typeof item.value>}`),
    };
  });

  const handleMemoVisibilityOptionChanged = async (visibility: string) => {
    onChange(visibility as Visibility);
  };

  return (
    <Selector
      className="visibility-selector"
      disabled={systemStatus.disablePublicMemos}
      tooltipTitle={t("memo.visibility.disabled")}
      value={value}
      dataSource={memoVisibilityOptionSelectorItems}
      handleValueChanged={handleMemoVisibilityOptionChanged}
    />
  );
};

export default MemoVisibilitySelector;
