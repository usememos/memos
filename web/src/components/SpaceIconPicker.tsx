import { create } from "@bufbuild/protobuf";
import CustomIconPicker from "@/components/CustomIconPicker";
import { type Space_Icon, Space_IconSchema } from "@/types/proto/api/v1/space_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  value?: Space_Icon;
  onChange: (icon: Space_Icon | undefined) => void;
  disabled?: boolean;
}

const SpaceIconPicker = ({ value, onChange, disabled }: Props) => {
  const t = useTranslate();
  return (
    <CustomIconPicker
      value={value}
      onChange={(icon) => onChange(icon ? create(Space_IconSchema, icon) : undefined)}
      disabled={disabled}
      label={t("space.icon.change")}
    />
  );
};

export default SpaceIconPicker;
