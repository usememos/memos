export const DEFAULT_FAVICON = "/favicon.svg?v=bird-blue";

// Earlier versions persisted /logo.webp when restoring the default profile.
// Treat built-in URLs as defaults so those instances also get the themeable SVG.
export const getCustomLogoUrl = (logoUrl?: string): string | undefined =>
  !logoUrl || logoUrl === "/logo.webp" || logoUrl === "/logo.svg" ? undefined : logoUrl;
