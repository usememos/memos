import { XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsageLimitEntry } from "@/hooks/useUsageLimitQueries";
import { extractUsernameFromName } from "@/lib/resource-names";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { newUsageLimitEntry, parseLimitInput, toLimitInput, USAGE_METRICS, type UsageMetric } from "./usageLimitValues";

type Inputs = Record<UsageMetric, string>;

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
  const candidateItems = users.filter((user) => !names.includes(user.name)).map((user) => ({ value: user.name, label: userLabel(user) }));

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!forAll && (
            <div className="grid gap-2">
              <Label>{t("setting.usage-limits.users")}</Label>
              {names.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {names.map((name) => {
                    const user = usersByName.get(name);
                    const label = user ? user.displayName || user.username : extractUsernameFromName(name);
                    return (
                      <li
                        key={name}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pr-1 pl-0.5 text-xs"
                      >
                        <UserAvatar className="h-5 w-5 shrink-0" avatarUrl={user?.avatarUrl} name={label} />
                        <span className="max-w-40 truncate">{label}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={t("setting.usage-limits.remove-user", { name: label })}
                          onClick={() => setNames((current) => current.filter((item) => item !== name))}
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Select value="" items={candidateItems} onValueChange={(name) => name && setNames((current) => [...current, name])}>
                <SelectTrigger className="w-full" aria-label={t("setting.usage-limits.users")}>
                  <SelectValue placeholder={t("setting.usage-limits.select-user")} />
                </SelectTrigger>
                <SelectContent>
                  {candidateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {names.length === 0 ? t("setting.usage-limits.users-required") : t("setting.usage-limits.users-description")}
              </p>
            </div>
          )}
          {fields.map(({ metric, label, help }) => {
            const message = isInvalid(metric) ? t("setting.usage-limits.invalid") : help;
            return (
              <div key={metric} className="grid gap-2">
                <Label htmlFor={`usage-limit-${metric}`}>{label}</Label>
                <Input
                  id={`usage-limit-${metric}`}
                  className="font-mono"
                  inputMode="decimal"
                  placeholder={t("setting.usage-limits.unlimited")}
                  value={inputs[metric]}
                  aria-invalid={isInvalid(metric)}
                  aria-describedby={message ? `usage-limit-help-${metric}` : undefined}
                  onChange={(event) => setInputs((current) => ({ ...current, [metric]: event.target.value }))}
                />
                {message && (
                  <p id={`usage-limit-help-${metric}`} className="text-xs text-muted-foreground">
                    {message}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {forAll ? t("setting.usage-limits.default-hint") : t("setting.usage-limits.entry-hint")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!isValid || saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UsageLimitDialog;
