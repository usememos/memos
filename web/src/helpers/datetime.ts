import i18n from "@/i18n";

export function getTimeStampByDate(t: Date | number | string | any): number {
  return new Date(t).getTime();
}

/**
 * Get a time string to provided time.
 *
 * If no date is provided, the current date is used.
 *
 * Output is always ``HH:MM`` (24-hour format)
 */
export function getTimeString(t?: Date | number | string): string {
  const tsFromDate = getTimeStampByDate(t ? t : Date.now());
  const d = new Date(tsFromDate);

  const hours = d.getHours();
  const mins = d.getMinutes();

  const hoursStr = hours < 10 ? "0" + hours : hours;
  const minsStr = mins < 10 ? "0" + mins : mins;

  return `${hoursStr}:${minsStr}`;
}

/**
 * Get a localized date and time string to provided time.
 *
 * If no date is provided, the current date is used.
 *
 * Sample outputs:
 * - "en" locale: "1/30/2023, 10:05:00 PM"
 * - "pt-BR" locale: "30/01/2023 22:05:00"
 * - "pl" locale: "30.01.2023, 22:05:00"
 */
export function getDateTimeString(t?: Date | number | string | any, locale = i18n.language): string {
  const tsFromDate = new Date(getTimeStampByDate(t ? t : Date.now()));
  try {
    return tsFromDate.toLocaleString(locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  } catch (error) {
    return tsFromDate.toLocaleString();
  }
}

/**
 * This returns the normalized date string of the provided date.
 * Format is always `YYYY-MM-DDT00:00`.
 *
 * If no date is provided, the current date is used.
 */
export function getNormalizedTimeString(t?: Date | number | string): string {
  const date = new Date(t ? t : Date.now());

  const yyyy = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const m = date.getMinutes();

  const MM = M < 10 ? "0" + M : M;
  const dd = d < 10 ? "0" + d : d;
  const hh = h < 10 ? "0" + h : h;
  const mm = m < 10 ? "0" + m : m;

  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

export function getNormalizedDateString(t?: Date | number | string): string {
  const date = new Date(t ? t : Date.now());

  const yyyy = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();

  const MM = M < 10 ? "0" + M : M;
  const dd = d < 10 ? "0" + d : d;

  return `${yyyy}-${MM}-${dd}`;
}

/**
 * Calculates a new Date object by adjusting the provided date, timestamp, or date string
 * based on the current timezone offset.
 *
 * @param t - The input date, timestamp, or date string (optional). If not provided,
 *            the current date and time will be used.
 * @returns A new Date object adjusted by the current timezone offset.
 */
export function getDateWithOffset(t?: Date | number | string): Date {
  return new Date(getTimeStampByDate(t) + new Date().getTimezoneOffset() * 60 * 1000);
}
