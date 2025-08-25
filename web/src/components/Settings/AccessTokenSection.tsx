import copy from "copy-to-clipboard";
import { ClipboardIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { UserAccessToken } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";

const listAccessTokens = async (parent: string) => {
  const { accessTokens } = await userServiceClient.listUserAccessTokens({ parent });
  return accessTokens.sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [userAccessTokens, setUserAccessTokens] = useState<UserAccessToken[]>([]);
  const createTokenDialog = useDialog();

  useEffect(() => {
    listAccessTokens(currentUser.name).then((accessTokens) => {
      setUserAccessTokens(accessTokens);
    });
  }, []);

  const handleCreateAccessTokenDialogConfirm = async () => {
    const accessTokens = await listAccessTokens(currentUser.name);
    setUserAccessTokens(accessTokens);
  };

  const handleCreateToken = () => {
    createTokenDialog.open();
  };

  const copyAccessToken = (accessToken: string) => {
    copy(accessToken);
    toast.success(t("setting.access-token-section.access-token-copied-to-clipboard"));
  };

  const handleDeleteAccessToken = async (userAccessToken: UserAccessToken) => {
    const formatedAccessToken = getFormatedAccessToken(userAccessToken.accessToken);
    const confirmed = window.confirm(t("setting.access-token-section.access-token-deletion", { accessToken: formatedAccessToken }));
    if (confirmed) {
      await userServiceClient.deleteUserAccessToken({ name: userAccessToken.name });
      setUserAccessTokens(userAccessTokens.filter((token) => token.accessToken !== userAccessToken.accessToken));
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
            <p className="flex flex-row justify-start items-center font-medium text-muted-foreground">
              {t("setting.access-token-section.title")}
            </p>
            <p className="text-sm text-muted-foreground">{t("setting.access-token-section.description")}</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button color="primary" onClick={handleCreateToken}>
              {t("common.create")}
            </Button>
          </div>
        </div>
        <div className="w-full mt-2 flow-root">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full border border-border rounded-lg align-middle">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                      {t("setting.access-token-section.token")}
                    </th>
                    <th scope="col" className="py-2 pl-4 pr-3 text-left text-sm font-semibold text-foreground">
                      {t("common.description")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                      {t("setting.access-token-section.create-dialog.created-at")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                      {t("setting.access-token-section.create-dialog.expires-at")}
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4">
                      <span className="sr-only">{t("common.delete")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userAccessTokens.map((userAccessToken) => (
                    <tr key={userAccessToken.accessToken}>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground flex flex-row justify-start items-center gap-x-1">
                        <span className="font-mono">{getFormatedAccessToken(userAccessToken.accessToken)}</span>
                        <Button variant="ghost" onClick={() => copyAccessToken(userAccessToken.accessToken)}>
                          <ClipboardIcon className="w-4 h-auto text-muted-foreground" />
                        </Button>
                      </td>
                      <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-foreground">{userAccessToken.description}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {userAccessToken.issuedAt?.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                        {userAccessToken.expiresAt?.toLocaleString() ?? t("setting.access-token-section.create-dialog.duration-never")}
                      </td>
                      <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            handleDeleteAccessToken(userAccessToken);
                          }}
                        >
                          <TrashIcon className="text-destructive w-4 h-auto" />
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

      {/* Create Access Token Dialog */}
      <CreateAccessTokenDialog
        open={createTokenDialog.isOpen}
        onOpenChange={createTokenDialog.setOpen}
        onSuccess={handleCreateAccessTokenDialogConfirm}
      />
    </div>
  );
};

export default AccessTokenSection;
