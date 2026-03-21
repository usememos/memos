import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserWebhook } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateWebhookDialog from "../CreateWebhookDialog";
import LearnMore from "../LearnMore";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [isCreateWebhookDialogOpen, setIsCreateWebhookDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWebhook | undefined>(undefined);

  const fetchWebhooks = async () => {
    if (!currentUser) return [];
    const { webhooks } = await userServiceClient.listUserWebhooks({
      parent: currentUser.name,
    });
    return webhooks;
  };

  useEffect(() => {
    fetchWebhooks().then(setWebhooks);
  }, [currentUser]);

  const handleCreateWebhookDialogConfirm = async () => {
    const webhooks = await fetchWebhooks();
    const name = webhooks[webhooks.length - 1]?.displayName || "";
    setWebhooks(webhooks);
    setIsCreateWebhookDialogOpen(false);
    toast.success(t("setting.webhook.create-dialog.create-webhook-success", { name }));
  };

  const handleDeleteWebhook = (webhook: UserWebhook) => {
    setDeleteTarget(webhook);
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteTarget) return;
    await userServiceClient.deleteUserWebhook({ name: deleteTarget.name });
    setWebhooks((prev) => prev.filter((item) => item.name !== deleteTarget.name));
    const name = deleteTarget.displayName;
    setDeleteTarget(undefined);
    toast.success(t("setting.webhook.delete-dialog.delete-webhook-success", { name }));
  };

  return (
    <SettingSection
      title={
        <div className="flex items-center gap-2">
          <span>{t("setting.webhook.title")}</span>
          <LearnMore url="https://usememos.com/docs/integrations/webhooks" />
        </div>
      }
      actions={
        <Button onClick={() => setIsCreateWebhookDialogOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("common.create")}
        </Button>
      }
    >
      <SettingTable
        columns={[
          {
            key: "displayName",
            header: t("common.name"),
            render: (_, webhook: UserWebhook) => <span className="text-foreground">{webhook.displayName}</span>,
          },
          {
            key: "url",
            header: t("setting.webhook.url"),
            render: (_, webhook: UserWebhook) => (
              <span className="max-w-[300px] inline-block truncate text-foreground" title={webhook.url}>
                {webhook.url}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, webhook: UserWebhook) => (
              <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook)}>
                <TrashIcon className="text-destructive w-4 h-auto" />
              </Button>
            ),
          },
        ]}
        data={webhooks}
        emptyMessage={t("setting.webhook.no-webhooks-found")}
        getRowKey={(webhook) => webhook.name}
      />

      <CreateWebhookDialog
        open={isCreateWebhookDialogOpen}
        onOpenChange={setIsCreateWebhookDialogOpen}
        onSuccess={handleCreateWebhookDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.webhook.delete-dialog.delete-webhook-title", { name: deleteTarget?.displayName || "" })}
        description={t("setting.webhook.delete-dialog.delete-webhook-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteWebhook}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default WebhookSection;
