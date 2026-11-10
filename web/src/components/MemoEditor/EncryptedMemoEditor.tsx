import { create } from "@bufbuild/protobuf";
import { Button, Field, Input, Textarea } from "@usememos/ui";
import { LockKeyholeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { VaultPanel } from "@/components/Encryption/VaultPanel";
import { lockEncryption, useVaultSession } from "@/contexts/E2EEContext";
import { useCreateMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { decodeMemo, decryptMemo, type EncryptedMemo, encodeRecord, encryptMemo } from "@/lib/e2ee/crypto";
import { registerEncryptedDraft } from "@/lib/e2ee/dirty";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type Memo, MemoSchema, Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  className?: string;
  onFocusModeExit?: () => void;
  memo?: Memo;
  editing?: boolean;
  onConfirm?: (name: string) => void;
  onCancel?: () => void;
  onSavingChange?: (saving: boolean) => void;
}
/** The restricted text mode of MemoEditor never mounts Markdown plugins or draft persistence. */
export function EncryptedMemoEditor(props: Props) {
  const vault = useVaultSession();
  const content = !vault.key ? (
    <LockedText {...props} />
  ) : (
    <UnlockedText key={`${vault.owner}:${vault.epoch}:${props.memo?.name ?? "new"}:${!!props.editing}`} {...props} />
  );
  return (
    <div className={cn(props.onFocusModeExit && "fixed inset-0 overflow-y-auto bg-mu-canvas p-4 sm:p-8", props.className)}>
      <div className={cn(props.onFocusModeExit && "mx-auto w-full max-w-2xl")}>{content}</div>
    </div>
  );
}
function LockedText({ memo, onCancel }: Props) {
  const t = useTranslate();
  const [open, setOpen] = useState(!memo);
  return (
    <div className="flex w-full flex-col gap-2">
      {memo && (
        <Button
          variant="ghost"
          icon={<LockKeyholeIcon />}
          className="h-auto w-full justify-start gap-2 whitespace-normal py-3 text-left"
          aria-label={`${t("e2ee.unlock")}: ${memo.encryptedTitle || t("e2ee.title")}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="min-w-0 break-words">{memo.encryptedTitle || t("e2ee.title")}</span>
        </Button>
      )}
      {open && <VaultPanel />}
      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}

function UnsavedGuard() {
  const t = useTranslate();
  const blocker = useBlocker(true);
  useEffect(() => registerEncryptedDraft(), []);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm(t("e2ee.unsaved"))) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, t]);
  return null;
}
function UnlockedText({ memo, editing = false, onConfirm, onCancel, onSavingChange }: Props) {
  const t = useTranslate();
  const { session, key, vaultId } = useVaultSession();
  const [initialMemo] = useState(memo);
  const source = editing ? initialMemo : memo;
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [title, setTitle] = useState(source?.encryptedTitle ?? "");
  const [savedTitle, setSavedTitle] = useState(source?.encryptedTitle ?? "");
  const [ready, setReady] = useState(!source);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const baseline = useRef<EncryptedMemo | undefined>(undefined);
  const alive = useRef(true);
  const createMemo = useCreateMemo();
  const updateMemo = useUpdateMemo();
  const dirty = editing && (content !== saved || title !== savedTitle);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const ticket = session.ticket();
    if (!source || !key) return;
    setReady(false);
    setFailed(false);
    const decrypt = async () => {
      const encrypted = decodeMemo(source.encryptedContent);
      if (encrypted.vaultId !== vaultId) throw new Error("Vault mismatch");
      const text = await decryptMemo(key, encrypted);
      if (active && session.current(ticket)) {
        baseline.current = encrypted;
        setTitle(source.encryptedTitle);
        setSavedTitle(source.encryptedTitle);
        setContent(text);
        setSaved(text);
        setReady(true);
      }
    };
    decrypt().catch(() => {
      if (active && session.current(ticket)) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [source, key, vaultId, session]);
  const save = async () => {
    if (!key || !vaultId || !ready || saving || !content.trim()) return;
    const ticket = session.ticket();
    setSaving(true);
    onSavingChange?.(true);
    try {
      const envelope = await encryptMemo(key, vaultId, content, baseline.current?.objectId);
      if (!session.current(ticket) || !alive.current) return;
      const encryptedContent = encodeRecord(envelope);
      const result = memo
        ? await updateMemo.mutateAsync({
            update: { name: memo.name, encryptedContent, encryptedTitle: title },
            updateMask: ["encrypted_content", "encrypted_title", "update_time"],
            expectedEncryptionRevision: baseline.current?.revisionId,
          })
        : await createMemo.mutateAsync({
            memo: create(MemoSchema, { content: "", encryptedContent, encryptedTitle: title, visibility: Visibility.PRIVATE }),
          });
      if (session.current(ticket) && alive.current) {
        baseline.current = envelope;
        setSaved(memo ? content : "");
        setSavedTitle(memo ? title : "");
        if (!memo) {
          setContent("");
          setTitle("");
          baseline.current = undefined;
        }
        onConfirm?.(result.name);
      }
    } catch {
      if (session.current(ticket) && alive.current) showErrorToast(t("e2ee.failed"));
    } finally {
      if (alive.current) setSaving(false);
      onSavingChange?.(false);
    }
  };
  return (
    <div className="flex w-full flex-col gap-3" data-testid="encrypted-memo">
      {dirty && <UnsavedGuard />}
      {failed ? (
        <p role="alert">{t("e2ee.failed")}</p>
      ) : !ready ? (
        <p>{t("editor.validation.loading-content")}</p>
      ) : editing ? (
        <>
          <p className="mu-caption text-mu-ink-muted">{t("e2ee.limitations")}</p>
          <Field.Root>
            <Field.Label>{t("e2ee.memo-title")}</Field.Label>
            <Input value={title} maxLength={256} disabled={saving} autoComplete="off" onChange={(event) => setTitle(event.target.value)} />
            <Field.Description>{t("e2ee.title-notice")}</Field.Description>
          </Field.Root>
          <Textarea
            aria-label={t("e2ee.title")}
            value={content}
            disabled={saving}
            spellCheck={false}
            autoComplete="off"
            className="min-h-40"
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="primary" disabled={saving || !content.trim()} onClick={() => void save()}>
              {t("common.save")}
            </Button>
            {onCancel && (
              <Button
                variant="neutral"
                disabled={saving}
                onClick={() => {
                  if (!dirty || window.confirm(t("e2ee.unsaved"))) onCancel();
                }}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {source?.encryptedTitle && <p className="mu-label break-words">{source.encryptedTitle}</p>}
          <div className="mu-body whitespace-pre-wrap break-words">{content}</div>
        </>
      )}
      <Button
        variant="neutral"
        icon={<LockKeyholeIcon />}
        className="self-start"
        onClick={() => {
          lockEncryption(t("e2ee.unsaved"));
        }}
      >
        {t("e2ee.lock")}
      </Button>
    </div>
  );
}
