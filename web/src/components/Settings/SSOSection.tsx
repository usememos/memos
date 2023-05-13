import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as api from "@/helpers/api";
import { Divider } from "@mui/joy";
import showCreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import Dropdown from "../kit/Dropdown";
import { showCommonDialog } from "../Dialog/CommonDialog";
import HelpButton from "../kit/HelpButton";

const SSOSection = () => {
  const { t } = useTranslation();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const fetchIdentityProviderList = async () => {
    const {
      data: { data: identityProviderList },
    } = await api.getIdentityProviderList();
    setIdentityProviderList(identityProviderList);
  };

  const handleDeleteIdentityProvider = async (identityProvider: IdentityProvider) => {
    showCommonDialog({
      title: t("setting.sso-section.delete-sso"),
      content: t("setting.sso-section.confirm-delete", { name: identityProvider.name }),
      style: "warning",
      dialogName: "delete-identity-provider-dialog",
      onConfirm: async () => {
        try {
          await api.deleteIdentityProvider(identityProvider.id);
        } catch (error: any) {
          console.error(error);
          toast.error(error.response.data.message);
        }
        await fetchIdentityProviderList();
      },
    });
  };

  return (
    <div className="section-container">
      <div className="mb-2 w-full flex flex-row justify-start items-center">
        <span className="font-mono text-sm text-gray-400 mr-2">{t("setting.sso-section.sso-list")}</span>
        <HelpButton icon="help" url="https://usememos.com/docs/keycloak" />
        <button
          className="btn-normal px-2 py-0 leading-7"
          onClick={() => showCreateIdentityProviderDialog(undefined, fetchIdentityProviderList)}
        >
          {t("common.create")}
        </button>
      </div>

      <Divider />

      {identityProviderList.map((identityProvider) => (
        <div
          key={identityProvider.id}
          className="py-2 w-full border-t last:border-b dark:border-zinc-700 flex flex-row items-center justify-between"
        >
          <div className="flex flex-row items-center">
            <p className="ml-2">
              {identityProvider.name}
              <span className="text-sm ml-1 opacity-40">({identityProvider.type})</span>
            </p>
          </div>
          <div className="flex flex-row items-center">
            <Dropdown
              actionsClassName="!w-28"
              actions={
                <>
                  <button
                    className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                    onClick={() => showCreateIdentityProviderDialog(identityProvider, fetchIdentityProviderList)}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-600"
                    onClick={() => handleDeleteIdentityProvider(identityProvider)}
                  >
                    {t("common.delete")}
                  </button>
                </>
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SSOSection;
