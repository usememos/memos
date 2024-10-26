import { Button } from "@usememos/mui";
import copy from "copy-to-clipboard";
import { ClipboardIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserAccessToken } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import showCreateAccessTokenDialog from "../CreateAccessTokenDialog";
import LearnMore from "../LearnMore";

const listAccessTokens = async (name: string) => {
  const { accessTokens } = await userServiceClient.listUserAccessTokens({ name });
  return accessTokens.sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userAccessTokens, setUserAccessTokens] = useState<UserAccessToken[]>([]);

  useEffect(() => {
    listAccessTokens(currentUser.name).then((accessTokens) => {
      setUserAccessTokens(accessTokens);
    });
  }, []);

  const handleCreateAccessTokenDialogConfirm = async () => {
    const accessTokens = await listAccessTokens(currentUser.name);
    setUserAccessTokens(accessTokens);
  };

  const copyAccessToken = (accessToken: string) => {
    copy(accessToken);
    toast.success("Access token copied to clipboard");
  };

  const handleDeleteAccessToken = async (accessToken: string) => {
    const confirmed = window.confirm(
      `Are you sure to delete access token \`${getFormatedAccessToken(accessToken)}\`? You cannot undo this action.`,
    );
    if (confirmed) {
      await userServiceClient.deleteUserAccessToken({ name: currentUser.name, accessToken: accessToken });
      setUserAccessTokens(userAccessTokens.filter((token) => token.accessToken !== accessToken));
    }
  };

  const getFormatedAccessToken = (accessToken: string) => {
    return `${accessToken.slice(0, 4)}****${accessToken.slice(-4)}`;
  };

  return (
    <div className="mt-6 w-full flex flex-col justify-start items-start space-y-4">
      <div className="w-full">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto space-y-1">
            <p className="flex flex-row justify-start items-center font-medium text-gray-700 dark:text-gray-400">
              Access Tokens
              <LearnMore className="ml-2" url="https://usememos.com/docs/security/access-tokens" />
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-500">A list of all access tokens for your account.</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button
              color="primary"
              onClick={() => {
                showCreateAccessTokenDialog(handleCreateAccessTokenDialogConfirm);
              }}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
        <div className="flow-root">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full py-2 align-middle">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-600">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      Token
                    </th>
                    <th scope="col" className="py-2 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      Created At
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                      Expires At
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4">
                      <span className="sr-only">{t("common.delete")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {userAccessTokens.map((userAccessToken) => (
                    <tr key={userAccessToken.accessToken}>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-gray-400 flex flex-row justify-start items-center gap-x-1">
                        <span className="font-mono">{getFormatedAccessToken(userAccessToken.accessToken)}</span>
                        <Button variant="plain" size="sm" onClick={() => copyAccessToken(userAccessToken.accessToken)}>
                          <ClipboardIcon className="w-4 h-auto text-gray-400" />
                        </Button>
                      </td>
                      <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-400">
                        {userAccessToken.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {userAccessToken.issuedAt?.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {userAccessToken.expiresAt?.toLocaleString() ?? "Never"}
                      </td>
                      <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm">
                        <Button
                          variant="plain"
                          size="sm"
                          onClick={() => {
                            handleDeleteAccessToken(userAccessToken.accessToken);
                          }}
                        >
                          <TrashIcon className="text-red-600 w-4 h-auto" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessTokenSection;
