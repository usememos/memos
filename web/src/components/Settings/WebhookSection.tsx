import { Button } from "@usememos/mui";
import { ExternalLinkIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { webhookServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Webhook } from "@/types/proto/api/v1/webhook_service";
import { useTranslate } from "@/utils/i18n";
import showCreateWebhookDialog from "../CreateWebhookDialog";

const listWebhooks = async (userId: number) => {
  const { webhooks } = await webhookServiceClient.listWebhooks({
    creatorId: userId,
  });
  return webhooks;
};

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  useEffect(() => {
    listWebhooks(currentUser.id).then((webhooks) => {
      setWebhooks(webhooks);
    });
  }, []);

  const handleCreateAccessTokenDialogConfirm = async () => {
    const webhooks = await listWebhooks(currentUser.id);
    setWebhooks(webhooks);
  };

  const handleDeleteWebhook = async (webhook: Webhook) => {
    const confirmed = window.confirm(`Are you sure to delete webhook \`${webhook.name}\`? You cannot undo this action.`);
    if (confirmed) {
      await webhookServiceClient.deleteWebhook({ id: webhook.id });
      setWebhooks(webhooks.filter((item) => item.id !== webhook.id));
    }
  };

  return (
    <div className="w-full flex flex-col justify-start items-start">
      <div className="w-full flex justify-between items-center">
        <div className="flex-auto space-y-1">
          <p className="flex flex-row justify-start items-center font-medium text-gray-700 dark:text-gray-400">
            {t("setting.webhook-section.title")}
          </p>
        </div>
        <div>
          <Button
            color="primary"
            onClick={() => {
              showCreateWebhookDialog(handleCreateAccessTokenDialogConfirm);
            }}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
      <div className="w-full mt-2 flow-root">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full border rounded-lg align-middle dark:border-zinc-600">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-600">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                    {t("common.name")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-400">
                    {t("setting.webhook-section.url")}
                  </th>
                  <th scope="col" className="relative px-3 py-2 pr-4">
                    <span className="sr-only">{t("common.delete")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-500">
                {webhooks.map((webhook) => (
                  <tr key={webhook.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-gray-400">{webhook.name}</td>
                    <td className="max-w-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-400 truncate" title={webhook.url}>
                      {webhook.url}
                    </td>
                    <td className="relative whitespace-nowrap px-3 py-2 text-right text-sm">
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => {
                          handleDeleteWebhook(webhook);
                        }}
                      >
                        <TrashIcon className="text-red-600 w-4 h-auto" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {webhooks.length === 0 && (
                  <tr>
                    <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-gray-400" colSpan={3}>
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
          className="text-gray-500 text-sm inline-flex flex-row justify-start items-center hover:underline hover:text-blue-600"
          to="https://usememos.com/docs/advanced-settings/webhook"
          target="_blank"
        >
          {t("common.learn-more")}
          <ExternalLinkIcon className="inline w-4 h-auto ml-1" />
        </Link>
      </div>
    </div>
  );
};

export default WebhookSection;
