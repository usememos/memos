import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { identityProviderServiceClient } from "@/connect";
import { handleError } from "@/lib/error";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

const SSOSection = () => {
  const t = useTranslate();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingIdentityProvider, setEditingIdentityProvider] = useState<IdentityProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<IdentityProvider | undefined>(undefined);

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  const handleDeleteIdentityProvider = async (identityProvider: IdentityProvider) => {
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
    setIsCreateDialogOpen(true);
  };

  const handleEditIdentityProvider = (identityProvider: IdentityProvider) => {
    setEditingIdentityProvider(identityProvider);
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = async () => {
    await fetchIdentityProviderList();
    setIsCreateDialogOpen(false);
    setEditingIdentityProvider(undefined);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    // Clear editing state when dialog is closed
    if (!open) {
      setEditingIdentityProvider(undefined);
    }
  };

  return (
    <SettingSection
      title={
        <div className="flex items-center gap-2">
          <span>{t("setting.sso-section.sso-list")}</span>
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
            key: "title",
            header: t("common.name"),
            render: (_, provider: IdentityProvider) => (
              <span className="text-foreground">
                {provider.title}
                <span className="ml-2 text-sm text-muted-foreground">({provider.type})</span>
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, provider: IdentityProvider) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVerticalIcon className="w-4 h-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={2}>
                  <DropdownMenuItem onClick={() => handleEditIdentityProvider(provider)}>{t("common.edit")}</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteIdentityProvider(provider)}
                    className="text-destructive focus:text-destructive"
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        data={identityProviderList}
        emptyMessage={t("setting.sso-section.no-sso-found")}
        getRowKey={(provider) => provider.name}
      />

      <CreateIdentityProviderDialog
        open={isCreateDialogOpen}
        onOpenChange={handleDialogOpenChange}
        identityProvider={editingIdentityProvider}
        onSuccess={handleDialogSuccess}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.sso-section.confirm-delete", { name: deleteTarget.title }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteIdentityProvider}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default SSOSection;
