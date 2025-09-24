import { MoreVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { identityProviderServiceClient } from "@/grpcweb";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";
import CreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";

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
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
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
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="w-full flex flex-row justify-between items-center gap-1">
        <div className="flex flex-row items-center gap-1">
          <span className="font-mono text-muted-foreground">{t("setting.sso-section.sso-list")}</span>
          <LearnMore url="https://www.usememos.com/docs/configuration/authentication" />
        </div>
        <Button color="primary" onClick={handleCreateIdentityProvider}>
          {t("common.create")}
        </Button>
      </div>
      <Separator />
      {identityProviderList.map((identityProvider) => (
        <div
          key={identityProvider.name}
          className="py-2 w-full border-b last:border-b border-border flex flex-row items-center justify-between"
        >
          <div className="flex flex-row items-center">
            <p className="ml-2">
              {identityProvider.title}
              <span className="text-sm ml-1 text-muted-foreground">({identityProvider.type})</span>
            </p>
          </div>
          <div className="flex flex-row items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVerticalIcon className="w-4 h-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={2}>
                <DropdownMenuItem onClick={() => handleEditIdentityProvider(identityProvider)}>{t("common.edit")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteIdentityProvider(identityProvider)}>{t("common.delete")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
      {identityProviderList.length === 0 && (
        <div className="w-full mt-2 text-sm border-border text-muted-foreground flex flex-row items-center justify-between">
          <p className="">{t("setting.sso-section.no-sso-found")}</p>
        </div>
      )}

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
    </div>
  );
};

export default SSOSection;
