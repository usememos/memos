import { isUsernameCharacter, isValidUsername } from "@/utils/username";

export interface MentionMatch {
  from: number;
  to: number;
  username: string;
}

function hasLeftBoundary(source: string, position: number, runHasLeftBoundary: boolean): boolean {
  if (position === 0) return runHasLeftBoundary;
  return !isUsernameCharacter(source[position - 1]);
}

/** Find username references in one eligible literal Markdown source run. */
export function findMentionMatches(source: string, runHasLeftBoundary = true): MentionMatch[] {
  const matches: MentionMatch[] = [];
  for (let position = 0; position < source.length; ) {
    if (source[position] !== "@" || !hasLeftBoundary(source, position, runHasLeftBoundary)) {
      position++;
      continue;
    }

    let end = position + 1;
    while (end < source.length && isUsernameCharacter(source[end])) end++;
    const username = source.slice(position + 1, end);
    if (isValidUsername(username)) {
      matches.push({ from: position, to: end, username });
    }
    position = end === position + 1 ? position + 1 : end;
  }
  return matches;
}
