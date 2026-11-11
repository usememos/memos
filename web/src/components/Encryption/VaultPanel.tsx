import { Code, ConnectError } from "@connectrpc/connect";
import { Button, Field, Input, Textarea } from "@usememos/ui";
import { useEffect, useState } from "react";
import { userServiceClient } from "@/connect";
import { lockEncryption, useVaultSession } from "@/contexts/E2EEContext";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { changePassphrase, createVault, decodeVault, encodeRecord, recoverVault, unlockVault, type VaultRecord } from "@/lib/e2ee/crypto";
import { showErrorToast } from "@/lib/toast";
import { useTranslate } from "@/utils/i18n";
import { PasskeyPanel } from "./PasskeyPanel";

/** Secrets remain in this mounted form; only wrapped records enter the API client. */
export function VaultPanel() {
  const { owner, epoch } = useVaultSession();
  return <VaultForm key={`${owner}:${epoch}`} />;
}
/** Handles vault setup, recovery, and passphrase changes while keeping secrets in form state. */
function VaultForm() {
  const t = useTranslate();
  const { session, key, owner } = useVaultSession();
  const [record, setRecord] = useState<VaultRecord | null>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof createVault>>>();
  const [busy, setBusy] = useState(false);
  const fields = useFieldErrors<"password" | "secret">();
  // Passkey unlock can accept the key from a sibling control. Do not carry an
  // abandoned unlock attempt into the now-visible change-passphrase form.
  useEffect(() => {
    if (key) {
      setPassword("");
      setSecret("");
      setRecovery(false);
    }
  }, [key]);
  useEffect(() => {
    let active = true;
    userServiceClient
      .getEncryptionVault({})
      .then((response) => {
        if (active) setRecord(response.vault.length ? decodeVault(response.vault) : null);
      })
      .catch((error) => {
        if (!active) return;
        if (ConnectError.from(error).code === Code.NotFound) setRecord(null);
        else setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    const ticket = session.ticket();
    if (!owner || record === undefined || busy) return;
    if (pending && secret.trim() !== pending.recoverySecret) {
      fields.set("secret", t("e2ee.failed"));
      return;
    }
    if (!pending && !recovery && (password.length < (record && !key ? 1 : 12) || password.length > 1024)) {
      fields.set("password", t("e2ee.passphrase-help"));
      return;
    }
    setBusy(true);
    try {
      if (pending) {
        const response = await userServiceClient.createEncryptionVault({ vault: encodeRecord(pending.record) });
        const stored = decodeVault(response.vault);
        if (stored.id !== pending.record.id) throw new Error("Vault identity mismatch");
        session.accept(ticket, pending.key, stored.id);
        if (session.current(ticket)) {
          setRecord(stored);
          setPending(undefined);
          setSecret("");
        }
      } else if (!record) {
        const created = await createVault(password);
        if (session.current(ticket)) {
          setPending(created);
          setPassword("");
        }
      } else if (key) {
        const changed = await changePassphrase(record, key, password);
        if (!session.current(ticket)) return;
        const response = await userServiceClient.updateEncryptionVault({ vault: encodeRecord(changed), expectedRevision: record.revision });
        if (session.current(ticket)) {
          setRecord(decodeVault(response.vault));
          setPassword("");
        }
      } else {
        const unlocked = recovery ? await recoverVault(record, secret) : await unlockVault(record, password);
        session.accept(ticket, unlocked, record.id);
        if (session.current(ticket)) {
          setPassword("");
          setSecret("");
          setRecovery(false);
        }
      }
    } catch {
      // Do not report crypto arguments or server responses to telemetry.
      if (session.current(ticket)) showErrorToast(t("e2ee.failed"));
    } finally {
      if (session.current(ticket)) setBusy(false);
    }
  };

  const controls = loadFailed ? (
    <p role="alert">{t("e2ee.failed")}</p>
  ) : record === undefined ? (
    <p>{t("editor.validation.loading-content")}</p>
  ) : (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {pending ? (
        <>
          <p className="mu-caption">{t("e2ee.recovery-warning")}</p>
          <Field.Root>
            <Field.Label>{t("e2ee.recovery-key")}</Field.Label>
            <Textarea readOnly value={pending.recoverySecret} />
          </Field.Root>
          <Field.Root invalid={!!fields.errors.secret}>
            <Field.Label>{t("e2ee.confirm-recovery")}</Field.Label>
            <Input
              autoComplete="off"
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value);
                fields.clear("secret");
              }}
            />
            {fields.errors.secret && <Field.Error match>{fields.errors.secret}</Field.Error>}
          </Field.Root>
        </>
      ) : recovery && !key ? (
        <Field.Root>
          <Field.Label>{t("e2ee.recovery-key")}</Field.Label>
          <Input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} />
        </Field.Root>
      ) : (
        <Field.Root invalid={!!fields.errors.password}>
          <Field.Label>{key ? t("e2ee.change-passphrase") : t("e2ee.passphrase")}</Field.Label>
          <Input
            type="password"
            autoComplete={record && !key ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              fields.clear("password");
            }}
          />
          <Field.Description>{t("e2ee.passphrase-help")}</Field.Description>
          {fields.errors.password && <Field.Error match>{fields.errors.password}</Field.Error>}
        </Field.Root>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} variant="primary">
          {pending ? t("common.confirm") : key ? t("common.save") : record ? t("e2ee.unlock") : t("e2ee.setup")}
        </Button>
        {!key && record && !pending && (
          <Button
            type="button"
            variant="neutral"
            disabled={busy}
            onClick={() => {
              setRecovery(!recovery);
              setPassword("");
              setSecret("");
            }}
          >
            {recovery ? t("e2ee.passphrase") : t("e2ee.recovery-key")}
          </Button>
        )}
        {(key || pending) && (
          <Button type="button" variant="neutral" onClick={() => lockEncryption(t("e2ee.unsaved"))}>
            {t("e2ee.lock")}
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <section className="flex w-full flex-col gap-3 rounded-mu-md border border-mu-line p-3">
      <h3 className="mu-label">{t("e2ee.title")}</h3>
      <p className="mu-caption text-mu-ink-muted">{t("e2ee.limitations")}</p>
      {record && !pending ? (
        <PasskeyPanel key={record.id} vaultId={record.id}>
          {controls}
        </PasskeyPanel>
      ) : (
        controls
      )}
    </section>
  );
}
