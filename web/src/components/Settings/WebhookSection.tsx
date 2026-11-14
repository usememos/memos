import { Button, List, Tooltip } from "@usememos/ui";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { toast } from "@/lib/toast";
import { UserWebhook } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateWebhookDialog from "../CreateWebhookDialog";
import LearnMore from "../LearnMore";
import { SettingList } from "./SettingList";
import SettingSection from "./SettingSection";

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [isCreateWebhookDialogOpen, setIsCreateWebhookDialogOpen] = useState(false);
  const [editingWebhookName, setEditingWebhookName] = useState<string | undefined>(undefined);
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
    toast.add({ title: t("setting.webhook.create-dialog.create-webhook-success", { name }), type: "success" });
  };

  const handleEditWebhook = (webhook: UserWebhook) => {
    setEditingWebhookName(webhook.name);
  };

  const handleEditWebhookDialogConfirm = async () => {
    const webhooks = await fetchWebhooks();
    setWebhooks(webhooks);
    setEditingWebhookName(undefined);
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
    toast.add({ title: t("setting.webhook.delete-dialog.delete-webhook-success", { name }), type: "success" });
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
        <Button variant="primary" onClick={() => setIsCreateWebhookDialogOpen(true)} icon={<PlusIcon />}>
          {t("common.create")}
        </Button>
      }
    >
      {webhooks.length === 0 ? (
        <p className="py-6 text-center mu-body text-mu-text-secondary">{t("setting.webhook.no-webhooks-found")}</p>
      ) : (
        <SettingList aria-label={t("setting.webhook.title")}>
          {webhooks.map((webhook) => (
            <List.Item key={webhook.name} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="mu-label break-words">{webhook.displayName}</p>
                <p className="mt-1 break-all mu-caption text-mu-text-secondary">{webhook.url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        onClick={() => handleEditWebhook(webhook)}
                        aria-label={`${t("common.edit")}: ${webhook.displayName}`}
                        icon={<PencilIcon />}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("common.edit")}</Tooltip.Popup>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteWebhook(webhook)}
                        aria-label={`${t("common.delete")}: ${webhook.displayName}`}
                        icon={<TrashIcon />}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("common.delete")}</Tooltip.Popup>
                </Tooltip.Root>
              </div>
            </List.Item>
          ))}
        </SettingList>
      )}

      <CreateWebhookDialog
        open={isCreateWebhookDialogOpen}
        onOpenChange={setIsCreateWebhookDialogOpen}
        onSuccess={handleCreateWebhookDialogConfirm}
      />
      <CreateWebhookDialog
        key={editingWebhookName ?? "edit-webhook-dialog"}
        open={!!editingWebhookName}
        onOpenChange={(open) => !open && setEditingWebhookName(undefined)}
        webhookName={editingWebhookName}
        onSuccess={handleEditWebhookDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.webhook.delete-dialog.delete-webhook-title", { name: deleteTarget?.displayName || "" })}
        description={t("setting.webhook.delete-dialog.delete-webhook-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteWebhook}
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default WebhookSection;
