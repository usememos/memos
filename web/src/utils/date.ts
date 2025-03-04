export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function dateSortDesc(a: string, b: string) {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}
