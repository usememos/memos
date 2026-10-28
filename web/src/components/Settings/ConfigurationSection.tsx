import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useConfigurationStatus } from "@/hooks/useConfigurationQueries";
import type { ConfigurationStatus_ManagedResource } from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import InfoChip from "./InfoChip";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

interface ManagedResourceRow extends Record<string, unknown> {
  resource: ConfigurationStatus_ManagedResource;
}

// What configuration files manage, read-only: changing it means editing a file.
const ConfigurationSection = () => {
  const t = useTranslate();
  const status = useConfigurationStatus();
  const rows: ManagedResourceRow[] = (status?.managedResources ?? []).map((resource) => ({ resource }));

  return (
    <SettingSection title={t("setting.configuration.label")} description={t("setting.configuration.description")}>
      {status && status.serial > 0n ? (
        <div className="flex flex-wrap gap-2">
          <InfoChip label={t("setting.configuration.serial")} value={status.serial.toString()} />
          {status.applyTime ? (
            <InfoChip label={t("setting.configuration.last-apply")} value={timestampDate(status.applyTime).toLocaleString()} />
          ) : null}
          <InfoChip label={t("setting.configuration.applied-by")} value={`${status.appliedBy} · ${status.version}`} />
        </div>
      ) : null}
      <SettingTable
        variant="info-flow"
        columns={[
          {
            key: "resource",
            header: t("setting.configuration.resource"),
            render: (_, row: ManagedResourceRow) => <span className="font-mono text-xs text-foreground">{row.resource.resource}</span>,
          },
          {
            key: "source",
            header: t("setting.configuration.source"),
            render: (_, row: ManagedResourceRow) => <span className="text-sm text-muted-foreground">{row.resource.source}</span>,
          },
          {
            key: "fields",
            header: t("setting.configuration.managed-fields"),
            render: (_, row: ManagedResourceRow) => (
              <div className="flex flex-wrap gap-2">
                <InfoChip
                  label={t("setting.configuration.managed-fields")}
                  value={
                    row.resource.managedFields.includes("*")
                      ? t("setting.configuration.whole-resource")
                      : row.resource.managedFields.join(", ")
                  }
                />
                {row.resource.ignoredFields.length > 0 ? (
                  <InfoChip label={t("setting.configuration.ignored-fields")} value={row.resource.ignoredFields.join(", ")} />
                ) : null}
              </div>
            ),
          },
        ]}
        data={rows}
        emptyMessage={t("setting.configuration.nothing-managed")}
        getRowKey={(row) => row.resource.resource}
      />
    </SettingSection>
  );
};

export default ConfigurationSection;
