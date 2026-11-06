import { Button, Combobox, Dialog, Field, Input } from "@usememos/ui";
import { XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import type { UsageLimitEntry } from "@/hooks/useUsageLimitQueries";
import { extractUsernameFromName } from "@/lib/resource-names";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { newUsageLimitEntry, parseLimitInput, toLimitInput, USAGE_METRICS, type UsageMetric } from "./usageLimitValues";

type Inputs = Record<UsageMetric, string>;

interface CandidateItem {
  value: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entry to edit, or undefined to add one. */
  entry?: UsageLimitEntry;
  /** The all-users entry, which pre-fills a new entry's fields. */
  defaults: UsageLimitEntry;
  users: User[];
  saving: boolean;
  onSave: (entry: UsageLimitEntry) => Promise<void>;
}

const userLabel = (user: User) => (user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`);

const inputsOf = (entry: UsageLimitEntry): Inputs =>
  Object.fromEntries(USAGE_METRICS.map((metric) => [metric, toLimitInput(metric, entry[metric])])) as Inputs;

/**
 * Edits one entry of the usage limits list: the users it names and one value
 * per metric. An empty field means no limit. A new entry starts from the
 * default's values so that leaving a field alone keeps the default rather than
 * removing the limit.
 */
function UsageLimitDialog({ open, onOpenChange, entry, defaults, users, saving, onSave }: Props) {
  const t = useTranslate();
  const forAll = entry?.allUsers === true;
  // The entry the fields start from: the one being edited, or the default
  // for a new entry.
  const source = entry ?? defaults;
  const sourceInputs = useMemo(() => inputsOf(source), [source]);
  const [names, setNames] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Inputs>(sourceInputs);

  useEffect(() => {
    if (!open) return;
    setNames(entry?.users ?? []);
    setInputs(sourceInputs);
  }, [open, entry, sourceInputs]);

  const usersByName = useMemo(() => new Map(users.map((user) => [user.name, user])), [users]);
  const candidateItems = useMemo((): CandidateItem[] => {
    const taken = new Set(names);
    return users.filter((user) => !taken.has(user.name)).map((user) => ({ value: user.name, label: userLabel(user) }));
  }, [users, names]);

  const parsed = (metric: UsageMetric) => parseLimitInput(metric, inputs[metric]);
  const isInvalid = (metric: UsageMetric) => parsed(metric) === null;
  const isValid = USAGE_METRICS.every((metric) => !isInvalid(metric)) && (forAll || names.length > 0);

  // The field text is a rounded view of a byte count, so a field the admin
  // did not touch keeps the stored value instead of a re-parsed one.
  const savedValue = (metric: UsageMetric) => (inputs[metric] === sourceInputs[metric] ? source[metric] : (parsed(metric) ?? undefined));

  const handleSave = async () => {
    const next = newUsageLimitEntry({
      users: forAll ? [] : names,
      allUsers: forAll,
      ...Object.fromEntries(USAGE_METRICS.map((metric) => [metric, savedValue(metric)])),
    });
    await onSave(next);
  };

  const fields: { metric: UsageMetric; label: string; help?: string }[] = [
    { metric: "memoCount", label: t("setting.usage-limits.memos"), help: t("setting.usage-limits.memos-description") },
    { metric: "memoContentBytes", label: t("setting.usage-limits.content-size"), help: t("setting.usage-limits.content-size-description") },
    { metric: "storageBytes", label: t("setting.usage-limits.storage"), help: t("setting.usage-limits.storage-description") },
    { metric: "uploadBytes", label: t("setting.usage-limits.file-size") },
  ];
  const title = forAll
    ? t("setting.usage-limits.default-title")
    : entry
      ? t("setting.usage-limits.edit-title")
      : t("setting.usage-limits.add-title");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>{title}</Dialog.Title>
        <div className="flex flex-col gap-4">
          {!forAll && (
            <Field.Root>
              <Field.Label>{t("setting.usage-limits.users")}</Field.Label>
              {names.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {names.map((name) => {
                    const user = usersByName.get(name);
                    const label = user ? user.displayName || user.username : extractUsernameFromName(name);
                    return (
                      <li
                        key={name}
                        className="flex items-center gap-1.5 rounded-full border border-mu-line bg-mu-well/40 py-0.5 pr-1 pl-0.5 mu-caption"
                      >
                        <UserAvatar className="h-5 w-5 shrink-0" avatarUrl={user?.avatarUrl} name={label} />
                        <span className="max-w-40 truncate">{label}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-mu-ink-muted hover:bg-mu-hover hover:text-mu-ink"
                          aria-label={t("setting.usage-limits.remove-user", { name: label })}
                          onClick={() => setNames((current) => current.filter((item) => item !== name))}
                        >
                          <XIcon className="mu-icon-xs" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* People type a name to find them: the instance may have many users. */}
              <Combobox.Root
                items={candidateItems}
                value={null}
                onValueChange={(item: CandidateItem | null) => item && setNames((current) => [...current, item.value])}
                itemToStringLabel={(item: CandidateItem) => item.label}
              >
                <Combobox.Input placeholder={t("setting.usage-limits.select-user")} triggerLabel={t("setting.usage-limits.users")} />
                <Combobox.Popup>
                  <Combobox.Empty>{t("message.no-data")}</Combobox.Empty>
                  <Combobox.List>
                    {(item: CandidateItem) => (
                      <Combobox.Item key={item.value} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Root>
              <Field.Description>
                {names.length === 0 ? t("setting.usage-limits.users-required") : t("setting.usage-limits.users-description")}
              </Field.Description>
            </Field.Root>
          )}
          {fields.map(({ metric, label, help }) => (
            <Field.Root key={metric} invalid={isInvalid(metric)}>
              <Field.Label>{label}</Field.Label>
              <Input
                id={`usage-limit-${metric}`}
                className="font-mono"
                inputMode="decimal"
                placeholder={t("setting.usage-limits.unlimited")}
                value={inputs[metric]}
                onChange={(event) => setInputs((current) => ({ ...current, [metric]: event.target.value }))}
              />
              {help && <Field.Description>{help}</Field.Description>}
              {isInvalid(metric) && <Field.Error match>{t("setting.usage-limits.invalid")}</Field.Error>}
            </Field.Root>
          ))}
          <p className="mu-caption text-mu-ink-muted">
            {forAll ? t("setting.usage-limits.default-hint") : t("setting.usage-limits.entry-hint")}
          </p>
        </div>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={!isValid || saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default UsageLimitDialog;
