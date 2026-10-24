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

const APPLE_MODIFIER_GLYPHS: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧", ctrl: "⌃" };
const OTHER_MODIFIER_NAMES: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift", ctrl: "Ctrl" };

/**
 * A key binding in the editor's key grammar ("Mod-Alt-s") as people read it on this
 * platform: "⌘⌥S" on Apple platforms, "Ctrl+Alt+S" elsewhere.
 */
export function shortcutLabel(binding: string): string {
  const parts = binding.split("-");
  const key = parts.pop() ?? "";
  const keyLabel = key.length === 1 ? key.toUpperCase() : key;
  const apple = isApplePlatform();
  const modifiers = parts.map((part) => (apple ? APPLE_MODIFIER_GLYPHS : OTHER_MODIFIER_NAMES)[part.toLowerCase()] ?? part);
  return [...modifiers, keyLabel].join(apple ? "" : "+");
}
