import i18n from "@/i18n";

export function getTimeStampByDate(t: Date | number | string | any): number {
  return new Date(t).getTime();
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
