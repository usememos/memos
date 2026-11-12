import { Button, Table, Tooltip } from "@usememos/ui";
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
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

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
      <SettingTable
        columns={[
          {
            key: "displayName",
            header: t("common.name"),
            render: (_, webhook: UserWebhook) => <span className="text-mu-ink">{webhook.displayName}</span>,
          },
          {
            key: "url",
            header: t("setting.webhook.url"),
            render: (_, webhook: UserWebhook) => (
              <span className="block max-w-[300px] truncate text-mu-ink" title={webhook.url}>
                {webhook.url}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            alignEnd: true,
            render: (_, webhook: UserWebhook) => (
              <Table.Actions className="pointer-coarse:gap-5">
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
              </Table.Actions>
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
