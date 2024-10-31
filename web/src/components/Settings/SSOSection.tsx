import { Divider, Dropdown, List, ListItem, Menu, MenuButton, MenuItem } from "@mui/joy";
import { Button } from "@usememos/mui";
import { MoreVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { identityProviderServiceClient } from "@/grpcweb";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";
import showCreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";

const SSOSection = () => {
  const t = useTranslate();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  const handleDeleteIdentityProvider = async (identityProvider: IdentityProvider) => {
    const confirmed = window.confirm(t("setting.sso-section.confirm-delete", { name: identityProvider.title }));
    if (confirmed) {
      try {
        await identityProviderServiceClient.deleteIdentityProvider({ name: identityProvider.name });
      } catch (error: any) {
        console.error(error);
        toast.error(error.details);
      }
      await fetchIdentityProviderList();
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="w-full flex flex-row justify-between items-center gap-1">
        <div className="flex flex-row items-center gap-1">
          <span className="font-mono text-gray-400">{t("setting.sso-section.sso-list")}</span>
          <LearnMore url="https://usememos.com/docs/advanced-settings/keycloak" />
        </div>
        <Button color="primary" onClick={() => showCreateIdentityProviderDialog(undefined, fetchIdentityProviderList)}>
          {t("common.create")}
        </Button>
      </div>
      <Divider />
      {identityProviderList.map((identityProvider) => (
        <div
          key={identityProvider.name}
          className="py-2 w-full border-b last:border-b dark:border-zinc-700 flex flex-row items-center justify-between"
        >
          <div className="flex flex-row items-center">
            <p className="ml-2">
              {identityProvider.title}
              <span className="text-sm ml-1 opacity-40">({identityProvider.type})</span>
            </p>
          </div>
          <div className="flex flex-row items-center">
            <Dropdown>
              <MenuButton size="sm">
                <MoreVerticalIcon className="w-4 h-auto" />
              </MenuButton>
              <Menu placement="bottom-end" size="sm">
                <MenuItem onClick={() => showCreateIdentityProviderDialog(identityProvider, fetchIdentityProviderList)}>
                  {t("common.edit")}
                </MenuItem>
                <MenuItem onClick={() => handleDeleteIdentityProvider(identityProvider)}>{t("common.delete")}</MenuItem>
              </Menu>
            </Dropdown>
          </div>
        </div>
      ))}
      {identityProviderList.length === 0 && (
        <div className="w-full mt-2 text-sm dark:border-zinc-700 opacity-60 flex flex-row items-center justify-between">
          <p className="">{t("setting.sso-section.no-sso-found")}</p>
        </div>
      )}

      <div className="w-full mt-4">
        <p className="text-sm">{t("common.learn-more")}:</p>
        <List component="ul" marker="disc" size="sm">
          <ListItem>
            <Link
              className="text-sm text-blue-600 hover:underline"
              to="https://www.usememos.com/docs/advanced-settings/keycloak"
              target="_blank"
            >
              {t("setting.sso-section.configuring-keycloak-for-authentication")}
            </Link>
          </ListItem>
        </List>
      </div>
    </div>
  );
};

export default SSOSection;
