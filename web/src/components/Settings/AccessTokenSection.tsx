import { Button, IconButton } from "@mui/joy";
import axios from "axios";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import useCurrentUser from "@/hooks/useCurrentUser";
import { ListUserAccessTokensResponse, UserAccessToken } from "@/types/proto/api/v2/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import showCreateAccessTokenDialog from "../CreateAccessTokenDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import LearnMore from "../LearnMore";

const listAccessTokens = async (username: string) => {
  const { data } = await axios.get<ListUserAccessTokensResponse>(`/api/v2/users/${username}/access_tokens`);
  return data.accessTokens;
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userAccessTokens, setUserAccessTokens] = useState<UserAccessToken[]>([]);

  useEffect(() => {
    listAccessTokens(currentUser.username).then((accessTokens) => {
      setUserAccessTokens(accessTokens);
    });
  }, []);

  const handleCreateAccessTokenDialogConfirm = async () => {
    const accessTokens = await listAccessTokens(currentUser.username);
    setUserAccessTokens(accessTokens);
  };

  const copyAccessToken = (accessToken: string) => {
    copy(accessToken);
    toast.success("Access token copied to clipboard");
  };

  const handleDeleteAccessToken = async (accessToken: string) => {
    showCommonDialog({
      title: "Delete Access Token",
      content: `Are you sure to delete access token \`${getFormatedAccessToken(accessToken)}\`? You cannot undo this action.`,
      style: "danger",
      dialogName: "delete-access-token-dialog",
      onConfirm: async () => {
        await axios.delete(`/api/v2/users/${currentUser.id}/access_tokens/${accessToken}`);
        setUserAccessTokens(userAccessTokens.filter((token) => token.accessToken !== accessToken));
      },
    });
  };

  const getFormatedAccessToken = (accessToken: string) => {
    return `${accessToken.slice(0, 4)}****${accessToken.slice(-4)}`;
  };

  return (
    <>
      <div className="mt-8 w-full flex flex-col justify-start items-start space-y-4">
        <div className="w-full">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="sm:flex-auto space-y-1">
              <p className="flex flex-row justify-start items-center font-medium text-gray-700 dark:text-gray-400">
                Access Tokens
                <LearnMore className="ml-2" url="https://usememos.com/docs/access-tokens" />
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-500">A list of all access tokens for your account.</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => {
                  showCreateAccessTokenDialog(handleCreateAccessTokenDialogConfirm);
                }}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
          <div className="mt-2 flow-root">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full py-2 align-middle">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-400">
                  <thead>
                    <tr>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                        Token
                      </th>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                        Description
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                        Created At
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                        Expires At
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4">
                        <span className="sr-only">{t("common.delete")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-500">
                    {userAccessTokens.map((userAccessToken) => (
                      <tr key={userAccessToken.accessToken}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-gray-400 flex flex-row justify-start items-center gap-x-1">
                          <span className="font-mono">{getFormatedAccessToken(userAccessToken.accessToken)}</span>
                          <IconButton
                            color="neutral"
                            variant="plain"
                            size="sm"
                            onClick={() => copyAccessToken(userAccessToken.accessToken)}
                          >
                            <Icon.Clipboard className="w-4 h-auto text-gray-400" />
                          </IconButton>
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-400">
                          {userAccessToken.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {String(userAccessToken.issuedAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {String(userAccessToken.expiresAt ?? "Never")}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm">
                          <IconButton
                            color="danger"
                            variant="plain"
                            size="sm"
                            onClick={() => {
                              handleDeleteAccessToken(userAccessToken.accessToken);
                            }}
                          >
                            <Icon.Trash className="w-4 h-auto" />
                          </IconButton>
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
    </>
  );
};

export default AccessTokenSection;
