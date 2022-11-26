// UNKNOWN_ID is the symbol for unknown id
export const UNKNOWN_ID = -1;

// default animation duration
export const ANIMATION_DURATION = 200;

// millisecond in a day
export const DAILY_TIMESTAMP = 3600 * 24 * 1000;

export const VISIBILITY_SELECTOR_ITEMS = [
  { text: "PUBLIC", value: "PUBLIC" },
  { text: "PROTECTED", value: "PROTECTED" },
  { text: "PRIVATE", value: "PRIVATE" },
];

export const MEMO_DISPLAY_TS_OPTION_SELECTOR_ITEMS = [
  { text: "created_ts", value: "created_ts" },
  { text: "created_ts", value: "updated_ts" },
];

export const IS_FOLDING_ENABLED_DEFAULT_VALUE = true;
export const SETTING_IS_FOLDING_ENABLED_KEY = "setting_IS_FOLDING_ENABLED";

export const TAB_SPACE_WIDTH = 2;

export const APPERANCE_OPTIONS = ["auto", "light", "dark"] as const;
export const APPERANCE_OPTIONS_STORAGE_KEY = "setting_APPERANCE_OPTIONS";
