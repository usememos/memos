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
