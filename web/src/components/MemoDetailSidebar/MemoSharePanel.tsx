import { timestampDate } from "@bufbuild/protobuf/wkt";
import { ConnectError } from "@connectrpc/connect";
import { Button, Dialog, Select, Skeleton, Tooltip } from "@usememos/ui";
import { CheckIcon, CopyIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { getShareUrl, useCreateMemoShare, useDeleteMemoShare, useMemoShares } from "@/hooks/useMemoShareQueries";
import { showErrorToast, toast } from "@/lib/toast";
import type { MemoShare } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

type ExpiryOption = "never" | "1d" | "7d" | "30d";

function getExpireDate(option: ExpiryOption): Date | undefined {
  if (option === "never") return undefined;
  const d = new Date();
  if (option === "1d") d.setDate(d.getDate() + 1);
  else if (option === "7d") d.setDate(d.getDate() + 7);
  else if (option === "30d") d.setDate(d.getDate() + 30);
  return d;
}

function formatExpiry(share: MemoShare, t: ReturnType<typeof useTranslate>): string {
  if (!share.expireTime) return t("memo.share.never-expires");
  const d = timestampDate(share.expireTime);
  return t("memo.share.expires-on", { date: d.toLocaleDateString() });
}

interface ShareLinkRowProps {
  share: MemoShare;
  memoName: string;
}

function ShareLinkRow({ share, memoName }: ShareLinkRowProps) {
  const t = useTranslate();
  const [copied, setCopied] = useState(false);
  const deleteShare = useDeleteMemoShare();
  const url = getShareUrl(share);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    try {
      await deleteShare.mutateAsync({ name: share.name, memoName });
      toast.add({ title: t("memo.share.revoked"), type: "success" });
    } catch (e) {
      showErrorToast((e as ConnectError).message || t("memo.share.revoke-failed"));
    }
  };

  return (
    <div className="flex flex-col gap-1 rounded-mu-md border border-mu-line p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono mu-caption text-mu-ink-muted">{url}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  aria-label={t("memo.share.copy")}
                  icon={copied ? <CheckIcon /> : <CopyIcon />}
                />
              }
            />
            <Tooltip.Popup>{t("memo.share.copy")}</Tooltip.Popup>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRevoke}
                  disabled={deleteShare.isPending}
                  aria-label={t("memo.share.revoke")}
                  icon={<Trash2Icon />}
                />
              }
            />
            <Tooltip.Popup>{t("memo.share.revoke")}</Tooltip.Popup>
          </Tooltip.Root>
        </div>
      </div>
      <p className="mu-caption text-mu-ink-muted">{formatExpiry(share, t)}</p>
    </div>
  );
}

interface MemoSharePanelProps {
  open: boolean;
  onClose: () => void;
  memoName: string;
}

const MemoSharePanel = ({ open, onClose, memoName }: MemoSharePanelProps) => {
  const t = useTranslate();
  const [expiry, setExpiry] = useState<ExpiryOption>("never");
  const { data: shares = [], isLoading } = useMemoShares(memoName, { enabled: open });
  const createShare = useCreateMemoShare();

  const expiryOptions = useMemo(
    () => [
      { value: "never", label: t("memo.share.expiry-never") },
      { value: "1d", label: t("memo.share.expiry-1-day") },
      { value: "7d", label: t("memo.share.expiry-7-days") },
      { value: "30d", label: t("memo.share.expiry-30-days") },
    ],
    [t],
  );

  const handleCreate = async () => {
    try {
      await createShare.mutateAsync({ memoName, expireTime: getExpireDate(expiry) });
    } catch (e) {
      showErrorToast((e as ConnectError).message || t("memo.share.create-failed"));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title className="flex items-center gap-2">
          <LinkIcon className="mu-icon" />
          {t("memo.share.title")}
        </Dialog.Title>

        <div className="flex flex-col gap-4 py-2">
          {/* Active links */}
          <div className="flex flex-col gap-2">
            <p className="mu-label text-mu-ink-muted">{t("memo.share.active-links")}</p>
            {isLoading ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("editor.blocks.loading")}>
                <Skeleton height={32} />
              </div>
            ) : shares.length === 0 ? (
              <p className="mu-body text-mu-ink-muted">{t("memo.share.no-links")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {shares.map((share) => (
                  <ShareLinkRow key={share.name} share={share} memoName={memoName} />
                ))}
              </div>
            )}
          </div>

          {/* Create new link */}
          <div className="flex items-center gap-2">
            <Select.Root value={expiry} items={expiryOptions} onValueChange={(v) => setExpiry(v as ExpiryOption)}>
              <Select.Trigger className="w-36">
                <Select.Value />
              </Select.Trigger>
              <Select.Popup>
                {expiryOptions.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Root>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={createShare.isPending}
              loadingLabel={t("memo.share.creating")}
              className="flex-1"
            >
              {t("memo.share.create-link")}
            </Button>
          </div>
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default MemoSharePanel;
