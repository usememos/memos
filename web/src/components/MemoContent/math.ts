const stripCode = (content: string): string =>
  content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`(?:\\.|[^`\n])*`/g, "");

// This is only a loading heuristic; remark-math remains the source of truth for
// parsing. Any unescaped dollar outside code triggers the math chunk: a false
// positive merely loads it, whereas mirroring remark-math's grammar here risks
// false negatives that would silently render real math as raw dollars.
export const hasMathSyntax = (content: string): boolean => /(^|[^\\])\$/.test(stripCode(content));
