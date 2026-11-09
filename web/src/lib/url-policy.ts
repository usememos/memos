/**
 * memos' link URL policy, one rule for the editor and for the memo view's raw-HTML
 * sanitizer alike, so a link the editor keeps is a link the view keeps: a link may be
 * relative, or use any scheme that hands off to another app instead of navigating the
 * browser, as `mailto:`, `sms:` and `tel:` do. A custom scheme such as `obsidian://` or
 * `slack://` is that, so it stays a link. Only the schemes that run script in the
 * instance's own origin are refused.
 */

/** Schemes that run script in the instance's own origin when navigated to. */
const SCRIPT_CAPABLE_SCHEMES = new Set(["javascript", "data", "vbscript", "livescript", "mocha"]);

/** A URL's scheme in lower case, or undefined when it has none: `#anchor`, `/path`, `path?q=1`. */
const schemeOf = (url: string): string | undefined => {
  // A browser reads a scheme past the whitespace it strips from a URL, so the check does too.
  const value = url.replace(/[\t\n\r]/g, "");
  const colon = value.indexOf(":");
  if (colon === -1) return undefined;
  // The first separator after the colon starts the path, query or fragment; a colon past it is not a scheme.
  const separator = Math.min(...["/", "?", "#"].map((character) => value.indexOf(character)).filter((index) => index !== -1));
  return Number.isFinite(separator) && colon > separator ? undefined : value.slice(0, colon).toLowerCase();
};

/** Whether a link may use `url`: it has no scheme, or a scheme that cannot run script. */
export const isAllowedLinkUrl = (url: string): boolean => {
  const scheme = schemeOf(url.trim());
  return scheme === undefined || !SCRIPT_CAPABLE_SCHEMES.has(scheme);
};

/** Schemes the editor's own paste rule linkifies, so this policy leaves them to it: `http(s)://` and `mailto:`. */
const EDITOR_PASTED_SCHEMES = /^(?:https?:\/\/|mailto:)/i;

/**
 * Whether a paste of plain text carrying `url` should make a link the editor's own paste
 * rule does not: one word, a scheme that hands off to another app as memos' link policy
 * allows. `obsidian://` and `slack://` are that; a sentence or a `javascript:` URI is not.
 */
export const isCustomSchemeUri = (url: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\S+$/i.test(url) && !EDITOR_PASTED_SCHEMES.test(url) && isAllowedLinkUrl(url);
