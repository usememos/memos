export const combineCELFilters = (...filters: Array<string | undefined>): string | undefined => {
  const conditions = filters.filter((filter): filter is string => Boolean(filter));
  return conditions.length === 0 ? undefined : conditions.map((filter) => `(${filter})`).join(" && ");
};

/** Selects top-level memos. A memo list without it includes comments, which are memos with a parent. */
export const TOP_LEVEL_MEMO_FILTER = "parent == null";

/** Selects the comments directly on the memo `memoName`. */
export const buildMemoCommentsFilter = (memoName: string): string => `parent == ${JSON.stringify(memoName)}`;

/** Selects the memos with the given resource names. */
export const buildMemoNamesFilter = (memoNames: string[]): string =>
  `name in [${memoNames.map((name) => JSON.stringify(name)).join(", ")}]`;

export type CollectionScope = { kind: "all" } | { kind: "space"; name: string };

export const buildCollectionScopeFilter = (scope: CollectionScope): string | undefined =>
  scope.kind === "space" ? `space == ${JSON.stringify(scope.name)}` : undefined;
