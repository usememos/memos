import { Badge, Button, Menu, Tooltip } from "@usememos/ui";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoChip from "@/components/Settings/InfoChip";
import {
  getIdentityProviderTypeLabel,
  getOAuth2SummaryItems,
  getSSOProviderUid,
  type SummaryItem,
} from "@/components/Settings/sso-display";
import { identityProviderServiceClient } from "@/connect";
import { findManagedResource, useConfigurationStatus } from "@/hooks/useConfigurationQueries";
import { useDialog } from "@/hooks/useDialog";
import { handleError } from "@/lib/error";
import { showErrorToast } from "@/lib/toast";
import { IdentityProvider } from "@/types/proto/api/idp_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

interface IdentityProviderRow extends Record<string, unknown> {
  name: string;
  providerUid: string;
  title: string;
  typeLabel: string;
  summaryItems: SummaryItem[];
  provider: IdentityProvider;
}

const SSOSection = () => {
  const t = useTranslate();
  const configurationStatus = useConfigurationStatus();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const [editingIdentityProvider, setEditingIdentityProvider] = useState<IdentityProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<IdentityProvider | undefined>(undefined);
  const idpDialog = useDialog();

  const fetchIdentityProviderList = async () => {
    try {
      const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
      setIdentityProviderList(identityProviders);
    } catch (error: unknown) {
      handleError(error, showErrorToast, {
        context: "Load identity providers",
      });
    }
  };

  useEffect(() => {
    void fetchIdentityProviderList();
  }, []);

  const rows = useMemo<IdentityProviderRow[]>(
    () =>
      identityProviderList.map((provider) => ({
        name: provider.name,
        providerUid: getSSOProviderUid(provider.name),
        title: provider.title,
        typeLabel: getIdentityProviderTypeLabel(provider.type),
        summaryItems: getOAuth2SummaryItems(provider, t),
        provider,
      })),
    [identityProviderList, t],
  );

  const handleDeleteIdentityProvider = (identityProvider: IdentityProvider) => {
    setDeleteTarget(identityProvider);
  };

  const confirmDeleteIdentityProvider = async () => {
    if (!deleteTarget) return;
    try {
      await identityProviderServiceClient.deleteIdentityProvider({ name: deleteTarget.name });
    } catch (error: unknown) {
      handleError(error, showErrorToast, {
        context: "Delete identity provider",
      });
    }
    await fetchIdentityProviderList();
    setDeleteTarget(undefined);
  };

  const handleCreateIdentityProvider = () => {
    setEditingIdentityProvider(undefined);
    idpDialog.open();
  };

  const handleEditIdentityProvider = (identityProvider: IdentityProvider) => {
    setEditingIdentityProvider(identityProvider);
    idpDialog.open();
  };

  const handleDialogSuccess = async () => {
    await fetchIdentityProviderList();
    idpDialog.close();
    setEditingIdentityProvider(undefined);
  };

  const handleDialogOpenChange = (open: boolean) => {
    idpDialog.setOpen(open);
    if (!open) {
      setEditingIdentityProvider(undefined);
    }
  };

  return (
    <SettingSection
      title={
        <div className="flex items-center gap-2">
          <span>{t("setting.sso.sso-list")}</span>
          <LearnMore url="https://usememos.com/docs/configuration/authentication" />
        </div>
      }
      actions={
        <Button variant="primary" onClick={handleCreateIdentityProvider} icon={<PlusIcon />}>
          {t("common.create")}
        </Button>
      }
    >
      <SettingTable
        variant="info-flow"
        columns={[
          {
            key: "title",
            header: t("setting.sso.provider"),
            render: (_, row: IdentityProviderRow) => (
              <div className="flex min-w-[16rem] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mu-label text-mu-ink">{row.title}</span>
                  <Badge>{row.typeLabel}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <InfoChip label={t("setting.sso.provider-uid")} value={row.providerUid} />
                  <ManagedByConfigurationChip resource={findManagedResource(configurationStatus, row.name)} />
                </div>
              </div>
            ),
          },
          {
            key: "summaryItems",
            header: t("setting.sso.configuration"),
            render: (_, row: IdentityProviderRow) => (
              <div className="flex min-w-[24rem] flex-col gap-2">
                <p className="mu-caption text-mu-ink-muted">{t("setting.sso.configuration-summary-description")}</p>
                <div className="flex flex-wrap gap-2">
                  {row.summaryItems.map((item) => (
                    <InfoChip key={item.key} label={item.label} value={item.value} tooltip={item.tooltip} />
                  ))}
                </div>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-px",
            alignEnd: true,
            render: (_, row: IdentityProviderRow) => (
              <Menu.Root modal={false}>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Menu.Trigger
                        render={<Button variant="ghost" aria-label={`${t("common.more")}: ${row.title}`} icon={<MoreVerticalIcon />} />}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                </Tooltip.Root>
                <Menu.Popup align="end">
                  <Menu.Item
                    disabled={!!findManagedResource(configurationStatus, row.name)}
                    onClick={() => handleEditIdentityProvider(row.provider)}
                  >
                    {t("common.edit")}
                  </Menu.Item>
                  {findManagedResource(configurationStatus, row.name) ? null : (
                    <Menu.Item onClick={() => handleDeleteIdentityProvider(row.provider)} danger>
                      {t("common.delete")}
                    </Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Root>
            ),
          },
        ]}
        data={rows}
        emptyMessage={t("setting.sso.no-sso-found")}
        getRowKey={(row) => row.name}
      />

      <CreateIdentityProviderDialog
        open={idpDialog.isOpen}
        onOpenChange={handleDialogOpenChange}
        identityProvider={editingIdentityProvider}
        onSuccess={handleDialogSuccess}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.sso.confirm-delete", { name: deleteTarget.title }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteIdentityProvider}
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default SSOSection;
