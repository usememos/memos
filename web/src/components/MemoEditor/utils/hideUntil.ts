export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeLocalValue(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return toDateTimeLocalValue(date) === value ? date : undefined;
}

export function isHiddenUntilFuture(hideUntil: Date | undefined, now: Date = new Date()): boolean {
  return hideUntil !== undefined && hideUntil.getTime() > now.getTime();
}

export function isSameHideUntil(a: Date | undefined, b: Date | undefined): boolean {
  return a?.getTime() === b?.getTime();
}
