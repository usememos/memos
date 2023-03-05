export const convertLanguageCodeToLocale = (codename: string): Locale => {
  if (codename === "zh-TW" || codename === "zh-HK") {
    return "hant";
  }
  const shortCode = codename.substring(0, 2);
  return shortCode as Locale;
};
