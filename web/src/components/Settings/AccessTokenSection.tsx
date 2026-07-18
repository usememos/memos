import { timestampDate } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { CopyIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { handleError } from "@/lib/error";
import { CreatePersonalAccessTokenResponse, PersonalAccessToken } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

const ApiUsageExample = () => {
  const t = useTranslate();
  const example = `curl ${window.location.origin}/api/v1/memos \\\n  -H "Authorization: Bearer memos_pat_..."`;

  const handleCopy = () => {
    copy(example);
    toast.success(t("message.copied"));
  };

  return (
    <div className="relative w-full min-w-0 rounded-lg border border-border/60 bg-background">
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-5 text-foreground/85">
        <code>{example}</code>
      </pre>
      <Button variant="ghost" size="icon" className="absolute top-1.5 right-1.5" aria-label={t("common.copy")} onClick={handleCopy}>
        <CopyIcon className="w-3.5 h-auto" />
      </Button>
    </div>
  );
};

const listAccessTokens = async (parent: string) => {
  const { personalAccessTokens } = await userServiceClient.listPersonalAccessTokens({ parent });
  return personalAccessTokens.sort(
    (a, b) =>
      ((b.createdAt ? timestampDate(b.createdAt) : undefined)?.getTime() ?? 0) -
      ((a.createdAt ? timestampDate(a.createdAt) : undefined)?.getTime() ?? 0),
  );
};

const AccessTokenSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [personalAccessTokens, setPersonalAccessTokens] = useState<PersonalAccessToken[]>([]);
  const createTokenDialog = useDialog();
  const [deleteTarget, setDeleteTarget] = useState<PersonalAccessToken | undefined>(undefined);

  useEffect(() => {
    if (!currentUser?.name) return;
    let canceled = false;
    listAccessTokens(currentUser.name)
      .then((tokens) => {
        if (!canceled) {
          setPersonalAccessTokens(tokens);
        }
      })
      .catch((error: unknown) => {
        if (!canceled) {
          handleError(error, toast.error, { context: "List access tokens" });
        }
      });
    return () => {
      canceled = true;
    };
  }, [currentUser?.name]);

  const handleCreateAccessTokenDialogConfirm = async (response: CreatePersonalAccessTokenResponse) => {
    const tokens = await listAccessTokens(currentUser?.name ?? "");
    setPersonalAccessTokens(tokens);
    // Copy the token to clipboard - this is the only time it will be shown
    if (response.token) {
      copy(response.token);
      toast.success(t("setting.access-token.access-token-copied-to-clipboard"));
    }
    toast.success(
      t("setting.access-token.create-dialog.access-token-created", {
        description: response.personalAccessToken?.description ?? "",
      }),
    );
  };

  const handleDeleteAccessToken = (token: PersonalAccessToken) => {
    setDeleteTarget(token);
  };

  const confirmDeleteAccessToken = async () => {
    if (!deleteTarget) return;
    const { name: tokenName, description } = deleteTarget;
    await userServiceClient.deletePersonalAccessToken({ name: tokenName });
    setPersonalAccessTokens((prev) => prev.filter((token) => token.name !== tokenName));
    setDeleteTarget(undefined);
    toast.success(t("setting.access-token.access-token-deleted", { description }));
  };

  return (
    <SettingSection
      title={t("setting.access-token.title")}
      description={t("setting.access-token.description")}
      actions={
        <Button onClick={createTokenDialog.open} size="sm">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {t("common.create")}
        </Button>
      }
    >
      <div className="grid w-full min-w-0 rounded-xl border border-border/60 bg-muted/20 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5 p-4 sm:p-5">
          <h4 className="text-sm font-medium text-foreground">{t("setting.access-token.about-title")}</h4>
          <p className="text-[13px] leading-6 text-muted-foreground">{t("setting.access-token.about-description")}</p>
          <ApiUsageExample />
          <a
            className="inline-flex w-fit items-center gap-1 text-[13px] leading-5 text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            href="https://usememos.com/docs/security/access-tokens"
            target="_blank"
            rel="noreferrer"
          >
            {t("common.learn-more")}
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 border-t border-border/60 p-4 sm:p-5 lg:border-t-0 lg:border-l">
          <h4 className="text-sm font-medium text-foreground">{t("setting.access-token.guidelines-title")}</h4>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-[13px] leading-5 text-muted-foreground marker:text-muted-foreground/40">
            <li>{t("setting.access-token.guideline-shown-once")}</li>
            <li>{t("setting.access-token.guideline-one-per-app")}</li>
            <li>{t("setting.access-token.guideline-expiration")}</li>
            <li>{t("setting.access-token.guideline-review")}</li>
          </ul>
        </div>
      </div>

      <SettingGroup title={t("setting.access-token.your-tokens")}>
        <SettingTable
          columns={[
            {
              key: "description",
              header: t("common.description"),
              render: (_, token: PersonalAccessToken) => <span className="text-foreground">{token.description}</span>,
            },
            {
              key: "createdAt",
              header: t("setting.access-token.create-dialog.created-at"),
              render: (_, token: PersonalAccessToken) => (token.createdAt ? timestampDate(token.createdAt) : undefined)?.toLocaleString(),
            },
            {
              key: "expiresAt",
              header: t("setting.access-token.create-dialog.expires-at"),
              render: (_, token: PersonalAccessToken) =>
                (token.expiresAt ? timestampDate(token.expiresAt) : undefined)?.toLocaleString() ??
                t("setting.access-token.create-dialog.duration-never"),
            },
            {
              key: "lastUsedAt",
              header: t("setting.access-token.last-used-at"),
              render: (_, token: PersonalAccessToken) =>
                (token.lastUsedAt ? timestampDate(token.lastUsedAt) : undefined)?.toLocaleString() ?? t("setting.access-token.never-used"),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (_, token: PersonalAccessToken) => (
                <Button variant="ghost" size="sm" onClick={() => handleDeleteAccessToken(token)}>
                  <TrashIcon className="text-destructive w-4 h-auto" />
                </Button>
              ),
            },
          ]}
          data={personalAccessTokens}
          emptyMessage={t("setting.access-token.no-tokens-found")}
          getRowKey={(token) => token.name}
        />
      </SettingGroup>

      {/* Create Access Token Dialog */}
      <CreateAccessTokenDialog
        open={createTokenDialog.isOpen}
        onOpenChange={createTokenDialog.setOpen}
        onSuccess={handleCreateAccessTokenDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.access-token.access-token-deletion", { description: deleteTarget.description }) : ""}
        description={t("setting.access-token.access-token-deletion-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteAccessToken}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default AccessTokenSection;
