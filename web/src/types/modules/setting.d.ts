interface Setting {
  locale: Locale;
  memoVisibility: Visibility;
  editorFontStyle: "normal" | "mono";
  mobileEditorStyle: "normal" | "float";
}

interface UserLocaleSetting {
  key: "locale";
  value: Locale;
}

interface UserMemoVisibilitySetting {
  key: "memoVisibility";
  value: Visibility;
}

interface UserEditorFontStyleSetting {
  key: "editorFontStyle";
  value: "normal" | "mono";
}

type UserSetting = UserLocaleSetting | UserMemoVisibilitySetting | UserEditorFontStyleSetting;

interface UserSettingUpsert {
  key: keyof Setting;
  value: string;
}
