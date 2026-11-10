import { Button } from "@usememos/ui";
import { FingerprintIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useVaultSession } from "@/contexts/E2EEContext";
import { useCreateEncryptionPasskey, useDeleteEncryptionPasskey, useEncryptionPasskeys } from "@/hooks/useEncryptionPasskeyQueries";
import { encodeRecord } from "@/lib/e2ee/crypto";
import {
  canUsePasskeys,
  createPasskey,
  decodePasskey,
  type PasskeyRecord,
  PasskeyUnavailableError,
  unlockWithPasskey,
} from "@/lib/e2ee/passkey";
import { showErrorToast } from "@/lib/toast";
import { useTranslate } from "@/utils/i18n";

/** Only encrypted wrappers cross the mutation boundary; credentials stay local. */
export function PasskeyPanel({ vaultId }: { vaultId: string }) {
  const t = useTranslate();
  const { session, owner, key } = useVaultSession();
  const query = useEncryptionPasskeys(owner);
  const add = useCreateEncryptionPasskey(owner);
  const remove = useDeleteEncryptionPasskey(owner);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const active = useRef(true);
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    const ticket = session.ticket();
    const unsubscribe = session.subscribe(() => {
      if (!session.current(ticket)) operation.current?.abort();
    });
    return () => {
      active.current = false;
      operation.current?.abort();
      unsubscribe();
    };
  }, [session, vaultId]);
  let records: PasskeyRecord[] = [];
  let invalid = false;
  try {
    if ((query.data?.passkeys.length ?? 0) > 10) throw new Error("Invalid wrapper count");
    records = (query.data?.passkeys ?? []).map(decodePasskey).filter((r) => r.vaultId === vaultId);
  } catch {
    invalid = true;
  }
  const eligible = records.filter((r) => r.rpId === location.hostname);
  const supported = canUsePasskeys();
  const run = async (action: (signal: AbortSignal, current: () => boolean) => Promise<void>) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const ticket = session.ticket();
    const current = () => active.current && session.current(ticket) && !controller.signal.aborted;
    setBusy(true);
    setUnavailable(false);
    try {
      await action(controller.signal, current);
    } catch (error) {
      if (current() && !(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError"))) {
        if (error instanceof PasskeyUnavailableError) setUnavailable(true);
        else showErrorToast(t("e2ee.passkey-failed"));
      }
    } finally {
      if (operation.current === controller) operation.current = undefined;
      if (active.current && session.current(ticket)) setBusy(false);
    }
  };
  if (query.isPending) return null;
  if (query.isError || invalid) return <p className="mu-caption text-mu-ink-muted">{t("e2ee.passkey-failed")}</p>;
  return (
    <div className="flex flex-col gap-3 border-t border-mu-line pt-3">
      <p className="mu-caption text-mu-ink-muted">{t("e2ee.passkey-help")}</p>
      {(!supported || unavailable) && (
        <p role="status" className="mu-caption text-mu-ink-muted">
          {t("e2ee.passkey-unavailable")}
        </p>
      )}
      {supported && !key && eligible.length > 0 && (
        <Button
          type="button"
          variant="primary"
          icon={<FingerprintIcon />}
          disabled={busy}
          onClick={() =>
            void run(async (signal, current) => {
              const unlocked = await unlockWithPasskey(eligible, vaultId, signal);
              if (current()) session.accept(session.ticket(), unlocked, vaultId);
            })
          }
        >
          {t("e2ee.passkey-unlock")}
        </Button>
      )}
      {key && (
        <>
          {supported && (
            <Button
              type="button"
              variant="neutral"
              icon={<FingerprintIcon />}
              disabled={busy || records.length >= 10}
              onClick={() =>
                void run(async (signal, current) => {
                  const wrapped = await createPasskey(key, vaultId, owner, signal, records);
                  if (current()) await add.mutateAsync({ passkey: encodeRecord(wrapped) });
                })
              }
            >
              {t("e2ee.passkey-add")}
            </Button>
          )}
          {records.length >= 10 && <p className="mu-caption">{t("e2ee.passkey-limit")}</p>}
          {records.map((record, index) => (
            <div key={record.id} className="flex items-center justify-between gap-2">
              <span className="mu-caption break-words">
                {t("e2ee.passkey-label", { number: index + 1 })} · {record.rpId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Trash2Icon />}
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("e2ee.passkey-remove-confirm")))
                    void run(async (_signal, current) => {
                      if (current()) await remove.mutateAsync({ id: record.id });
                    });
                }}
              >
                {t("e2ee.passkey-remove")}
              </Button>
            </div>
          ))}
        </>
      )}
      {busy && (
        <Button type="button" variant="ghost" onClick={() => operation.current?.abort()}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}
