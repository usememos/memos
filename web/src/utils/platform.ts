interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

/**
 * Whether the primary modifier key is ⌘ (Apple platforms) rather than Ctrl.
 * Used only to render shortcut hints; key handling itself is platform-agnostic.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithUAData;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Display glyph for the primary modifier: ⌘ on Apple platforms, Ctrl elsewhere. */
export function primaryModifierGlyph(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}

/** Display form of a primary-modifier shortcut for `key`: "⌘K" on Apple platforms, "Ctrl+K" elsewhere. */
export function primaryModifierShortcut(key: string): string {
  return `${isApplePlatform() ? "⌘" : "Ctrl+"}${key.toUpperCase()}`;
}
