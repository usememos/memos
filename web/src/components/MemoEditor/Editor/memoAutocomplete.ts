import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { buildMemoReferenceMarkdown } from "@/lib/memo-reference";

/** One memo the `@` picker can insert a reference to. */
export interface MemoReferenceCandidate {
  uid: string;
  /** A one-line preview, the only way the author can tell candidates apart. */
  snippet: string;
}

/** Resolves the memos matching what the author typed after `@`, best first. */
export type MemoReferenceSearch = (query: string) => Promise<MemoReferenceCandidate[]>;

/**
 * Past this many characters the `@` was prose, not a trigger. Long enough for a
 * few words of search, short enough that writing a sentence after a stray `@`
 * stops querying.
 */
const MAX_QUERY_LENGTH = 40;

/**
 * Collapses a burst of typing into one search. A keystroke aborts the previous
 * completion context, so waiting before the request is enough — no timer state.
 */
const DEFAULT_DEBOUNCE_MS = 150;

/** `@` starts a reference only at a word boundary, so `name@example.com` is left alone. */
const isTriggerBoundary = (previous: string | undefined): boolean => previous === undefined || !/[\w@]/.test(previous);

/** The text between a trigger `@` and the cursor, or `undefined` when there is no trigger. */
export const findMemoReferenceQuery = (line: string, position: number): { from: number; query: string } | undefined => {
  const at = line.lastIndexOf("@", position - 1);
  if (at < 0 || !isTriggerBoundary(line[at - 1])) return undefined;
  const query = line.slice(at + 1, position);
  // A query opening with a space is a sentence continuing after an `@`, not a search.
  if (query.length > MAX_QUERY_LENGTH || query.includes("@") || /^\s/.test(query)) return undefined;
  return { from: at, query };
};

export function makeMemoCompletionSource(searchMemos: MemoReferenceSearch, debounceMs: number = DEFAULT_DEBOUNCE_MS) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const trigger = findMemoReferenceQuery(line.text, ctx.pos - line.from);
    if (!trigger) return null;

    if (debounceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, debounceMs));
      if (ctx.aborted) return null;
    }

    let candidates: MemoReferenceCandidate[];
    try {
      candidates = await searchMemos(trigger.query);
    } catch (error) {
      console.error(error);
      return null;
    }
    if (ctx.aborted || candidates.length === 0) return null;

    const from = line.from + trigger.from;
    const options: Completion[] = candidates.map((candidate) => ({
      label: candidate.snippet,
      type: "text",
      // Selecting a memo replaces `@query` with the reference, leaving the cursor
      // after it so the sentence being written just continues.
      apply: (view, _completion, applyFrom, applyTo) => {
        const insert = buildMemoReferenceMarkdown(candidate.uid);
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert },
          selection: { anchor: applyFrom + insert.length },
          userEvent: "input.complete",
        });
      },
    }));
    // The search already ranked the memos, and a snippet is prose: CodeMirror's
    // fuzzy matcher would re-score it against the query and drop good hits.
    return { from, to: ctx.pos, options, filter: false };
  };
}
