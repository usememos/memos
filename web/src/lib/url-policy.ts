/** Schemes that can execute scripts or load active content. */
const SCRIPT_CAPABLE_SCHEMES = new Set(["javascript", "data", "vbscript", "livescript", "mocha"]);

/** The leading controls and spaces a browser strips from a URL before it reads the scheme. */
const stripLeadingControls = (url: string): string => {
  let start = 0;
  while (start < url.length && url.charCodeAt(start) <= 0x20) start += 1;
  return url.slice(start);
};

/** A URL's scheme in lower case, or undefined when it has none: `#anchor`, `/path`, `path?q=1`. */
const schemeOf = (url: string): string | undefined => {
  // A browser reads a scheme past the controls it strips from a URL, so the check does too.
  const value = stripLeadingControls(url).replace(/[\t\n\r]/g, "");
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
