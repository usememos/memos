import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { identityProviderServiceClient } from "@/connect";
import { useDialog } from "@/hooks/useDialog";
import { handleError } from "@/lib/error";
import { IdentityProvider, IdentityProvider_Type } from "@/types/proto/api/v1/idp_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

interface IdentityProviderRow extends Record<string, unknown> {
  name: string;
  providerUid: string;
  title: string;
  typeLabel: string;
  provider: IdentityProvider;
}

const getIdentityProviderUID = (name: string) => name.replace(/^identity-providers\//, "");

const SSOSection = () => {
  const t = useTranslate();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const [editingIdentityProvider, setEditingIdentityProvider] = useState<IdentityProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<IdentityProvider | undefined>(undefined);
  const idpDialog = useDialog();

  const fetchIdentityProviderList = async () => {
    try {
      const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
      setIdentityProviderList(identityProviders);
    } catch (error: unknown) {
      handleError(error, toast.error, {
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
        providerUid: getIdentityProviderUID(provider.name),
        title: provider.title,
        typeLabel: IdentityProvider_Type[provider.type] ?? "TYPE_UNSPECIFIED",
        provider,
      })),
    [identityProviderList],
  );

  const handleDeleteIdentityProvider = (identityProvider: IdentityProvider) => {
    setDeleteTarget(identityProvider);
  };

  const confirmDeleteIdentityProvider = async () => {
    if (!deleteTarget) return;
    try {
      await identityProviderServiceClient.deleteIdentityProvider({ name: deleteTarget.name });
    } catch (error: unknown) {
      handleError(error, toast.error, {
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
        <Button onClick={handleCreateIdentityProvider}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("common.create")}
        </Button>
      }
    >
      <SettingTable
        columns={[
          {
            key: "providerUid",
            header: "provider_uid",
            render: (_, row: IdentityProviderRow) => (
              <div className="flex flex-col">
                <span className="text-foreground">{row.providerUid}</span>
                {row.title ? <span className="text-sm text-muted-foreground">{row.title}</span> : null}
              </div>
            ),
          },
          {
            key: "typeLabel",
            header: t("common.type"),
            render: (_, row: IdentityProviderRow) => <span className="text-muted-foreground">{row.typeLabel}</span>,
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, row: IdentityProviderRow) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVerticalIcon className="w-4 h-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={2}>
                  <DropdownMenuItem onClick={() => handleEditIdentityProvider(row.provider)}>{t("common.edit")}</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteIdentityProvider(row.provider)}
                    className="text-destructive focus:text-destructive"
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default SSOSection;
