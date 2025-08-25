import { ExternalLinkIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserWebhook } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import CreateWebhookDialog from "../CreateWebhookDialog";

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [isCreateWebhookDialogOpen, setIsCreateWebhookDialogOpen] = useState(false);

  const listWebhooks = async () => {
    if (!currentUser) return [];
    const { webhooks } = await userServiceClient.listUserWebhooks({
      parent: currentUser.name,
    });
    return webhooks;
  };

  useEffect(() => {
    listWebhooks().then((webhooks) => {
      setWebhooks(webhooks);
    });
  }, [currentUser]);

  const handleCreateWebhookDialogConfirm = async () => {
    const webhooks = await listWebhooks();
    setWebhooks(webhooks);
    setIsCreateWebhookDialogOpen(false);
  };

  const handleDeleteWebhook = async (webhook: UserWebhook) => {
    const confirmed = window.confirm(`Are you sure to delete webhook \`${webhook.displayName}\`? You cannot undo this action.`);
    if (confirmed) {
      await userServiceClient.deleteUserWebhook({ name: webhook.name });
      setWebhooks(webhooks.filter((item) => item.name !== webhook.name));
    }
  };

  return (
    <div className="w-full flex flex-col justify-start items-start">
      <div className="w-full flex justify-between items-center">
        <div className="flex-auto space-y-1">
          <p className="flex flex-row justify-start items-center font-medium text-muted-foreground">{t("setting.webhook-section.title")}</p>
        </div>
        <div>
          <Button color="primary" onClick={() => setIsCreateWebhookDialogOpen(true)}>
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
                    {t("common.name")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">
                    {t("setting.webhook-section.url")}
                  </th>
                  <th scope="col" className="relative px-3 py-2 pr-4">
                    <span className="sr-only">{t("common.delete")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {webhooks.map((webhook) => (
                  <tr key={webhook.name}>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground">{webhook.displayName}</td>
                    <td className="max-w-[200px] px-3 py-2 text-sm text-foreground truncate" title={webhook.url}>
                      {webhook.url}
                    </td>
                    <td className="relative whitespace-nowrap px-3 py-2 text-right text-sm">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          handleDeleteWebhook(webhook);
                        }}
                      >
                        <TrashIcon className="text-destructive w-4 h-auto" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {webhooks.length === 0 && (
                  <tr>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground" colSpan={3}>
                      {t("setting.webhook-section.no-webhooks-found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="w-full mt-2">
        <Link
          className="text-muted-foreground text-sm inline-flex flex-row justify-start items-center hover:underline hover:text-primary"
          to="https://www.usememos.com/docs/integrations/webhooks"
          target="_blank"
        >
          {t("common.learn-more")}
          <ExternalLinkIcon className="inline w-4 h-auto ml-1" />
        </Link>
      </div>
      <CreateWebhookDialog
        open={isCreateWebhookDialogOpen}
        onOpenChange={setIsCreateWebhookDialogOpen}
        onSuccess={handleCreateWebhookDialogConfirm}
      />
    </div>
  );
};

export default WebhookSection;
