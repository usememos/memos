import i18n from "@/i18n";

export function convertToMillis(localSetting: LocalSetting) {
  const hoursToMillis = localSetting.dailyReviewTimeOffset * 60 * 60 * 1000;
  return hoursToMillis;
}

export function getNowTimeStamp(): number {
  return Date.now();
}

export function getTimeStampByDate(t: Date | number | string): number {
  if (typeof t === "string") {
    t = t.replaceAll("-", "/");
  }

  return new Date(t).getTime();
}

export function getDateStampByDate(t?: Date | number | string): number {
  const tsFromDate = getTimeStampByDate(t ? t : Date.now());
  const d = new Date(tsFromDate);

  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function getNormalizedDateString(t?: Date | number | string): string {
  const tsFromDate = getTimeStampByDate(t ? t : Date.now());
  const d = new Date(tsFromDate);

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();

  return `${year}/${month}/${date}`;
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
export function getDateTimeString(t?: Date | number | string, locale = i18n.language): string {
  const tsFromDate = getTimeStampByDate(t ? t : Date.now());

  return new Date(tsFromDate).toLocaleDateString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

/**
 * Get a localized date string to provided time.
 *
 * If no date is provided, the current date is used.
 *
 * Note: This function does not include time information.
 *
 * Sample outputs:
 * - "en" locale: "1/30/2023"
 * - "pt-BR" locale: "30/01/2023"
 * - "pl" locale: "30.01.2023"
 */
export function getDateString(t?: Date | number | string, locale = i18n.language): string {
  const tsFromDate = getTimeStampByDate(t ? t : Date.now());

  return new Date(tsFromDate).toLocaleDateString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Get a localized relative time string to provided time.
 *
 * Possible outputs for "long" format and "en" locale:
 * - "x seconds ago"
 * - "x minutes ago"
 * - "x hours ago"
 * - "yesterday"
 * - "x days ago"
 * - "x weeks ago"
 * - "x months ago"
 * - "last year"
 * - "x years ago"
 *
 */
export const getRelativeTimeString = (time: number, locale = i18n.language, formatStyle: "long" | "short" | "narrow" = "long"): string => {
  const pastTimeMillis = Date.now() - time;
  const secMillis = 1000;
  const minMillis = secMillis * 60;
  const hourMillis = minMillis * 60;
  const dayMillis = hourMillis * 24;

  // numeric: "auto" provides "yesterday" for 1 day ago, "always" provides "1 day ago"
  const formatOpts = { style: formatStyle, numeric: "auto" } as Intl.RelativeTimeFormatOptions;

  const relTime = new Intl.RelativeTimeFormat(locale, formatOpts);

  if (pastTimeMillis < minMillis) {
    return relTime.format(-Math.round(pastTimeMillis / secMillis), "second");
  }

  if (pastTimeMillis < hourMillis) {
    return relTime.format(-Math.round(pastTimeMillis / minMillis), "minute");
  }

  if (pastTimeMillis < dayMillis) {
    return relTime.format(-Math.round(pastTimeMillis / hourMillis), "hour");
  }

  if (pastTimeMillis < dayMillis * 7) {
    return relTime.format(-Math.round(pastTimeMillis / dayMillis), "day");
  }

  if (pastTimeMillis < dayMillis * 30) {
    return relTime.format(-Math.round(pastTimeMillis / (dayMillis * 7)), "week");
  }

  if (pastTimeMillis < dayMillis * 365) {
    return relTime.format(-Math.round(pastTimeMillis / (dayMillis * 30)), "month");
  }

  return relTime.format(-Math.round(pastTimeMillis / (dayMillis * 365)), "year");
};

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

/**
 * This returns the number of **milliseconds** since the Unix Epoch of the provided date.
 *
 * If no date is provided, the current date is used.
 *
 * ```
 * getUnixTimeMillis("2019-01-25 00:00") // 1548381600000
 * ```
 * To get a Unix timestamp (the number of seconds since the epoch), use `getUnixTime()`.
 */
export function getUnixTimeMillis(t?: Date | number | string): number {
  const date = new Date(t ? t : Date.now());
  return date.getTime();
}

/**
 * This returns the Unix timestamp (the number of **seconds** since the Unix Epoch) of the provided date.
 *
 * If no date is provided, the current date is used.
 * ```
 * getUnixTime("2019-01-25 00:00") // 1548381600
 * ```
 * This value is floored to the nearest second, and does not include a milliseconds component.
 */
export function getUnixTime(t?: Date | number | string): number {
  const date = new Date(t ? t : Date.now());
  return Math.floor(date.getTime() / 1000);
}
