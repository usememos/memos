export const combineCELFilters = (...filters: Array<string | undefined>): string | undefined => {
  const conditions = filters.filter((filter): filter is string => Boolean(filter));
  return conditions.length === 0 ? undefined : conditions.map((filter) => `(${filter})`).join(" && ");
};

export const buildSpaceFilter = (spaceName?: string): string => (spaceName ? `space == ${JSON.stringify(spaceName)}` : "space == null");
