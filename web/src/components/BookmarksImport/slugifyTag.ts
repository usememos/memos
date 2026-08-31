// Folder name → tag slug. The server tag parser accepts `-`, `+`, `&` and unicode
// letters/digits inside tags (internal/markdown/parser/tag.go), so hyphens are safe.
// ponytail: regex-based slug; full NFKD transliteration if non-Latin folders appear.
export function slugifyTag(folder: string): string {
  const slug = folder
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/g, "");
  return slug === "unsorted" ? "" : slug;
}
