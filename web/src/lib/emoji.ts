import { EMOJI } from "./emoji-data";

const COMMON_EMOJI = ["👍", "❤️", "🎉", "😄", "👀", "🚀", "🙏", "🔥"];
const aliases: Record<string, string> = {
  "👍": "thumbsup thumbs up +1 like yes approve",
  "👎": "thumbsdown thumbs down -1 dislike no",
  "❤️": "love heart",
  "🎉": "tada party celebration",
  "😄": "smile happy laugh",
  "🙏": "thanks thank you please pray",
  "💯": "100 hundred",
};
export const EMOJI_OPTIONS = EMOJI.map(([emoji, name]) => ({ emoji, name, search: `${name} ${aliases[emoji] ?? ""}`.toLowerCase() }));
const emojiByGlyph = new Map(EMOJI_OPTIONS.map((option) => [option.emoji, option]));
const defaultOptions = [
  ...COMMON_EMOJI.flatMap((emoji) => emojiByGlyph.get(emoji) ?? []),
  ...EMOJI_OPTIONS.filter(({ emoji }) => !COMMON_EMOJI.includes(emoji)),
];

export function findEmoji(query: string) {
  const terms = query.trim().toLowerCase().replaceAll(":", "").replaceAll("_", " ").split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return defaultOptions;
  }
  return EMOJI_OPTIONS.filter(({ emoji, search }) => emoji === query.trim() || terms.every((term) => search.includes(term)));
}

export const emojiName = (emoji: string) => emojiByGlyph.get(emoji)?.name ?? emoji;
