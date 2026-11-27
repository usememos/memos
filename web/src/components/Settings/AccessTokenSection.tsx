import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Button, Collapsible, List, Tooltip } from "@usememos/ui";
import copy from "copy-to-clipboard";
import { CopyIcon, ExternalLinkIcon, KeyRoundIcon, PlusIcon, ScissorsIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import RelativeTime from "@/components/RelativeTime";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { WEB_CLIPPER_URL } from "@/lib/constants";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { CreatePersonalAccessTokenResponse, PersonalAccessToken } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";
import SettingSection from "./SettingSection";

const EXPIRING_SOON_MS = 30 * 24 * 60 * 60 * 1000;

const ApiUsageExample = () => {
  const t = useTranslate();
  const example = `curl ${window.location.origin}/api/memos \\\n  -H "Authorization: Bearer memos_pat_..."`;

  const handleCopy = () => {
    copy(example);
    toast.add({ title: t("message.copied"), type: "success" });
  };

  return (
    <div className="relative w-full min-w-0 rounded-mu-lg border border-mu-line/60 bg-mu-well/30">
      <pre className="overflow-x-auto p-3 pe-12 font-mono mu-caption text-mu-text/85">
        <code>{example}</code>
      </pre>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              className="absolute top-1.5 end-1.5"
              aria-label={t("common.copy")}
              onClick={handleCopy}
              icon={<CopyIcon />}
            />
          }
        />
        <Tooltip.Popup>{t("common.copy")}</Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
};

type TokenStatus = "active" | "expiring" | "idle";

const getTokenStatus = (lastUsedAt: Date | undefined, expiresAt: Date | undefined): TokenStatus => {
  if (expiresAt && expiresAt.getTime() - Date.now() < EXPIRING_SOON_MS) {
    return "expiring";
  }
  return lastUsedAt ? "active" : "idle";
};

const StatusDot = ({ status }: { status: TokenStatus }) => (
  <span
    aria-hidden="true"
    className={`size-1.5 shrink-0 rounded-full ${
      status === "active" ? "bg-mu-success" : status === "expiring" ? "bg-mu-warning" : "bg-mu-text-secondary/40"
    }`}
  />
);

const listAccessTokens = async (parent: string) => {
  const { personalAccessTokens } = await userServiceClient.listPersonalAccessTokens({ parent });
  return personalAccessTokens.sort(
    (a, b) =>
      ((b.createTime ? timestampDate(b.createTime) : undefined)?.getTime() ?? 0) -
      ((a.createTime ? timestampDate(a.createTime) : undefined)?.getTime() ?? 0),
  );
};

const HowToUseDisclosure = () => {
  const t = useTranslate();

  return (
    <Collapsible.Root size="sm">
      <Collapsible.Trigger>{t("setting.access-token.how-to-use")}</Collapsible.Trigger>
      <Collapsible.Panel>
        <div className="grid gap-4 pt-2 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="mu-caption text-mu-text-secondary">{t("setting.access-token.about-description")}</p>
            <ApiUsageExample />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <a
                className="inline-flex items-center gap-1 mu-caption text-mu-text-secondary underline-offset-4 hover:text-mu-accent hover:underline"
                href="https://usememos.com/docs/security/access-tokens"
                target="_blank"
                rel="noreferrer"
              >
                {t("common.learn-more")}
                <ExternalLinkIcon className="mu-icon-xs" />
              </a>
              <a
                className="inline-flex items-center gap-1 mu-caption text-mu-text-secondary underline-offset-4 hover:text-mu-accent hover:underline"
                href={WEB_CLIPPER_URL}
                target="_blank"
                rel="noreferrer"
              >
                <ScissorsIcon className="mu-icon-xs" />
                {t("setting.access-token.web-clipper-title")}
                <ExternalLinkIcon className="mu-icon-xs" />
              </a>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 mu-caption text-mu-text-secondary">
            {[
              t("setting.access-token.guideline-shown-once"),
              t("setting.access-token.guideline-one-per-app"),
              t("setting.access-token.guideline-expiration"),
              t("setting.access-token.guideline-review"),
            ].map((guideline) => (
              <li key={guideline} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-mu-text-secondary/40" />
                {guideline}
              </li>
            ))}
          </ul>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const t = useTranslate();
  return (
    <div className="rounded-mu-lg border border-dashed border-mu-line px-6 py-10 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-mu-lg bg-mu-primary/10 text-mu-primary">
        <KeyRoundIcon className="mu-icon" />
      </span>
      <h4 className="mt-3 mu-label text-mu-text">{t("setting.access-token.empty-title")}</h4>
      <p className="mx-auto mt-1 max-w-sm mu-caption text-mu-text-secondary">{t("setting.access-token.empty-description")}</p>
      <div className="mx-auto mt-4 max-w-md text-left">
        <ApiUsageExample />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Button variant="neutral" onClick={onCreate} icon={<PlusIcon />}>
          {t("setting.access-token.create-first")}
        </Button>
        <a
          className="inline-flex items-center gap-1.5 mu-caption text-mu-text-secondary hover:text-mu-text"
          href={WEB_CLIPPER_URL}
          target="_blank"
          rel="noreferrer"
        >
          <ScissorsIcon className="mu-icon-sm" />
          {t("setting.access-token.web-clipper-title")}
        </a>
      </div>
    </div>
  );
};

const TokenRow = ({ token, onDelete }: { token: PersonalAccessToken; onDelete: (token: PersonalAccessToken) => void }) => {
  const t = useTranslate();
  const lastUsedAt = token.lastUseTime ? timestampDate(token.lastUseTime) : undefined;
  const expiresAt = token.expireTime ? timestampDate(token.expireTime) : undefined;
  const status = getTokenStatus(lastUsedAt, expiresAt);

  return (
    <List.Item className="group flex items-center gap-3">
      <StatusDot status={status} />
      <div className="min-w-0 flex-1">
        <div className="mu-label-sm text-mu-text">{token.description}</div>
        <div className="mt-0.5 mu-caption text-mu-text-secondary">
          {lastUsedAt ? (
            <>
              {t("setting.access-token.last-used")} <RelativeTime date={lastUsedAt} />
            </>
          ) : (
            t("setting.access-token.never-used")
          )}
          {" · "}
          {expiresAt ? (
            <span className={status === "expiring" ? "text-mu-warning" : ""}>
              {t("setting.access-token.expires")} <RelativeTime date={expiresAt} />
            </span>
          ) : (
            t("setting.access-token.no-expiration")
          )}
        </div>
      </div>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              aria-label={t("common.delete")}
              className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={() => onDelete(token)}
              icon={<Trash2Icon />}
            />
          }
        />
        <Tooltip.Popup>{t("common.delete")}</Tooltip.Popup>
      </Tooltip.Root>
    </List.Item>
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
          handleError(error, showErrorToast, { context: "List access tokens" });
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
      toast.add({ title: t("setting.access-token.access-token-copied-to-clipboard"), type: "success" });
    }
    toast.add({
      title: t("setting.access-token.create-dialog.access-token-created", {
        description: response.personalAccessToken?.description ?? "",
      }),
      type: "success",
    });
  };

  const confirmDeleteAccessToken = async () => {
    if (!deleteTarget) return;
    const { name: tokenName, description } = deleteTarget;
    await userServiceClient.deletePersonalAccessToken({ name: tokenName });
    setPersonalAccessTokens((prev) => prev.filter((token) => token.name !== tokenName));
    setDeleteTarget(undefined);
    toast.add({ title: t("setting.access-token.access-token-deleted", { description }), type: "success" });
  };

  return (
    <SettingSection
      title={t("setting.access-token.title")}
      description={t("setting.access-token.description")}
      actions={
        <Button variant="primary" onClick={createTokenDialog.open} icon={<PlusIcon />}>
          {t("common.create")}
        </Button>
      }
    >
      {personalAccessTokens.length === 0 ? (
        <EmptyState onCreate={createTokenDialog.open} />
      ) : (
        <>
          <HowToUseDisclosure />
          <List.Root aria-label={t("setting.access-token.title")}>
            {personalAccessTokens.map((token) => (
              <TokenRow key={token.name} token={token} onDelete={setDeleteTarget} />
            ))}
          </List.Root>
        </>
      )}

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
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default AccessTokenSection;
