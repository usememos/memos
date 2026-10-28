import type { ConfigurationStatus_ManagedResource } from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import InfoChip from "./InfoChip";

interface Props {
  resource?: ConfigurationStatus_ManagedResource;
}

// Marks a resource configuration files manage, naming the file to edit.
const ManagedByConfigurationChip = ({ resource }: Props) => {
  const t = useTranslate();
  if (!resource) {
    return null;
  }
  return (
    <InfoChip
      label={t("setting.configuration.managed-by")}
      value={resource.source}
      tooltip={t("setting.configuration.managed-tooltip", { source: resource.source })}
    />
  );
};

export default ManagedByConfigurationChip;
