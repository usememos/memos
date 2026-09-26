import { create } from "@bufbuild/protobuf";
import { HashIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import CustomIconPicker from "@/components/CustomIconPicker";
import type { CustomIconValue } from "@/lib/custom-icons";
import { type UserSetting_TagMetadata_Icon, UserSetting_TagMetadata_IconSchema } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  /** Named in the control's label, so a list of tags does not become a list of identical buttons. */
  tag: string;
  /** The mark currently shown for the tag, whatever it was resolved from. */
  value?: CustomIconValue;
  onChange: (icon: UserSetting_TagMetadata_Icon | undefined) => void;
  disabled?: boolean;
  trigger?: ReactElement;
  triggerContent?: ReactNode;
}

/** The tag flavour of the shared icon picker: default mark is the # a tag shows without an icon. */
const TagIconPicker = ({ tag, value, onChange, disabled, trigger, triggerContent }: Props) => {
  const t = useTranslate();
  return (
    <CustomIconPicker
      value={value}
      onChange={(icon) => onChange(icon ? create(UserSetting_TagMetadata_IconSchema, icon) : undefined)}
      disabled={disabled}
      label={t("setting.tags.set-icon", { tag })}
      fallback={HashIcon}
      trigger={trigger}
      triggerContent={triggerContent}
    />
  );
};

export default TagIconPicker;
