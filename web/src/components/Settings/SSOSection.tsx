import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../../helpers/api";
import showCreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import Dropdown from "../common/Dropdown";
import { showCommonDialog } from "../Dialog/CommonDialog";
import toastHelper from "../Toast";

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
      title: "Confirm delete",
      content: "Are you sure to delete this SSO? THIS ACTION IS IRREVERSIABLE❗",
      style: "warning",
      dialogName: "delete-identity-provider-dialog",
      onConfirm: async () => {
        try {
          await api.deleteIdentityProvider(identityProvider.id);
        } catch (error: any) {
          console.error(error);
          toastHelper.error(error.response.data.message);
        }
        await fetchIdentityProviderList();
      },
    });
  };

  return (
    <div className="section-container">
      <div className="mt-4 mb-2 w-full flex flex-row justify-start items-center">
        <span className="font-mono text-sm text-gray-400 mr-2">SSO List</span>
        <button
          className="btn-normal px-2 py-0 leading-7"
          onClick={() => showCreateIdentityProviderDialog(undefined, fetchIdentityProviderList)}
        >
          {t("common.create")}
        </button>
      </div>
      <div className="mt-2 w-full flex flex-col">
        {identityProviderList.map((identityProvider) => (
          <div key={identityProvider.id} className="py-2 w-full border-t last:border-b flex flex-row items-center justify-between">
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
                      Edit
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
    </div>
  );
};

export default SSOSection;
