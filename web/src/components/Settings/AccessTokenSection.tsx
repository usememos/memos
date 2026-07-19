import { timestampDate } from "@bufbuild/protobuf/wkt";
import copy from "copy-to-clipboard";
import { ChevronRightIcon, CopyIcon, ExternalLinkIcon, KeyRoundIcon, PlusIcon, ScissorsIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import RelativeTime from "@/components/RelativeTime";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useDialog } from "@/hooks/useDialog";
import { WEB_CLIPPER_URL } from "@/lib/constants";
import { handleError } from "@/lib/error";
import { CreatePersonalAccessTokenResponse, PersonalAccessToken } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateAccessTokenDialog from "../CreateAccessTokenDialog";
import SettingSection from "./SettingSection";

const EXPIRING_SOON_MS = 30 * 24 * 60 * 60 * 1000;

const ApiUsageExample = () => {
  const t = useTranslate();
  const example = `curl ${window.location.origin}/api/v1/memos \\\n  -H "Authorization: Bearer memos_pat_..."`;

  const handleCopy = () => {
    copy(example);
    toast.success(t("message.copied"));
  };

  return (
    <div className="relative w-full min-w-0 rounded-lg border border-border/60 bg-muted/30">
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-5 text-foreground/85">
        <code>{example}</code>
      </pre>
      <Button variant="ghost" size="icon" className="absolute top-1.5 right-1.5" aria-label={t("common.copy")} onClick={handleCopy}>
        <CopyIcon className="w-3.5 h-auto" />
      </Button>
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
      status === "active" ? "bg-success" : status === "expiring" ? "bg-warning" : "bg-muted-foreground/40"
    }`}
  />
);

const listAccessTokens = async (parent: string) => {
  const { personalAccessTokens } = await userServiceClient.listPersonalAccessTokens({ parent });
  return personalAccessTokens.sort(
    (a, b) =>
      ((b.createdAt ? timestampDate(b.createdAt) : undefined)?.getTime() ?? 0) -
      ((a.createdAt ? timestampDate(a.createdAt) : undefined)?.getTime() ?? 0),
  );
};

const HowToUseDisclosure = () => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRightIcon className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        {t("setting.access-token.how-to-use")}
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border/60 p-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="text-xs leading-5 text-muted-foreground">{t("setting.access-token.about-description")}</p>
            <ApiUsageExample />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <a
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                href="https://usememos.com/docs/security/access-tokens"
                target="_blank"
                rel="noreferrer"
              >
                {t("common.learn-more")}
                <ExternalLinkIcon className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                href={WEB_CLIPPER_URL}
                target="_blank"
                rel="noreferrer"
              >
                <ScissorsIcon className="size-3" />
                {t("setting.access-token.web-clipper-title")}
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-5 text-muted-foreground">
            {[
              t("setting.access-token.guideline-shown-once"),
              t("setting.access-token.guideline-one-per-app"),
              t("setting.access-token.guideline-expiration"),
              t("setting.access-token.guideline-review"),
            ].map((guideline) => (
              <li key={guideline} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                {guideline}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const t = useTranslate();
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <KeyRoundIcon className="size-4" />
      </span>
      <h4 className="mt-3 text-sm font-medium text-foreground">{t("setting.access-token.empty-title")}</h4>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">{t("setting.access-token.empty-description")}</p>
      <div className="mx-auto mt-4 max-w-md text-left">
        <ApiUsageExample />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Button size="sm" onClick={onCreate}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {t("setting.access-token.create-first")}
        </Button>
        <a
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          href={WEB_CLIPPER_URL}
          target="_blank"
          rel="noreferrer"
        >
          <ScissorsIcon className="size-3.5" />
          {t("setting.access-token.web-clipper-title")}
        </a>
      </div>
    </div>
  );
};

const TokenRow = ({ token, onDelete }: { token: PersonalAccessToken; onDelete: (token: PersonalAccessToken) => void }) => {
  const t = useTranslate();
  const lastUsedAt = token.lastUsedAt ? timestampDate(token.lastUsedAt) : undefined;
  const expiresAt = token.expiresAt ? timestampDate(token.expiresAt) : undefined;
  const status = getTokenStatus(lastUsedAt, expiresAt);

  return (
    <li className="group flex items-center gap-3 px-4 py-3">
      <StatusDot status={status} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">{token.description}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {lastUsedAt ? (
            <>
              {t("setting.access-token.last-used")} <RelativeTime date={lastUsedAt} />
            </>
          ) : (
            t("setting.access-token.never-used")
          )}
          {" · "}
          {expiresAt ? (
            <span className={status === "expiring" ? "text-warning" : ""}>
              {t("setting.access-token.expires")} <RelativeTime date={expiresAt} />
            </span>
          ) : (
            t("setting.access-token.no-expiration")
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("common.delete")}
        className="text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        onClick={() => onDelete(token)}
      >
        <Trash2Icon className="w-3.5 h-auto" />
      </Button>
    </li>
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
      {personalAccessTokens.length === 0 ? (
        <EmptyState onCreate={createTokenDialog.open} />
      ) : (
        <>
          <HowToUseDisclosure />
          <ul className="m-0 flex list-none flex-col divide-y divide-border/60 rounded-xl border border-border/60 p-0">
            {personalAccessTokens.map((token) => (
              <TokenRow key={token.name} token={token} onDelete={setDeleteTarget} />
            ))}
          </ul>
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
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default AccessTokenSection;
