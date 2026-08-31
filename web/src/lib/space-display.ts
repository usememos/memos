const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const LONG_CUSTOM_UID_LENGTH = 18;

export const extractSpaceUidFromName = (name: string): string => name.split("/").at(-1) ?? "";

export const getDuplicateSpaceTitles = (spaces: readonly { title: string }[]): ReadonlySet<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const space of spaces) {
    if (seen.has(space.title)) {
      duplicates.add(space.title);
    } else {
      seen.add(space.title);
    }
  }

  return duplicates;
};

export const formatSpaceUidForDisplay = (name: string): string => {
  const uid = extractSpaceUidFromName(name);
  if (UUID_PATTERN.test(uid)) {
    return `${uid.slice(0, 8)}…`;
  }
  if (uid.length > LONG_CUSTOM_UID_LENGTH) {
    return `${uid.slice(0, 8)}…${uid.slice(-6)}`;
  }
  return uid;
};
