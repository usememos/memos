import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { MENTION_RUN } from "@/utils/mention-grammar";
import { findMarkdownTagMatches, markdownGFMEmailSourceRanges } from "./markdownTagRanges";
import { viewportDecorations } from "./viewportDecorations";

const MENTION_RE = new RegExp(`(^|[^A-Za-z0-9])@(${MENTION_RUN})`, "gu");
const tagMark = Decoration.mark({ class: "cm-memo-tag" });
const mentionMark = Decoration.mark({ class: "cm-memo-mention" });

function build(view: EditorView): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const visibleLines = view.visibleRanges
    .map(({ from, to }) => ({ from: view.state.doc.lineAt(from).from, to: view.state.doc.lineAt(to).to }))
    .sort((left, right) => left.from - right.from);
  const scanRanges: Array<{ from: number; to: number }> = [];
  for (const range of visibleLines) {
    const previous = scanRanges.at(-1);
    if (previous && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
    else scanRanges.push({ ...range });
  }
  const emailRanges = markdownGFMEmailSourceRanges(view.state, scanRanges.at(-1)?.to ?? view.viewport.to);

  for (const { from, to } of scanRanges) {
    for (const match of findMarkdownTagMatches(view.state, from, to)) {
      ranges.push({ from: match.from, to: match.to, deco: tagMark });
    }

    const text = view.state.doc.sliceString(from, to);
    MENTION_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MENTION_RE.exec(text)) !== null) {
      const start = from + match.index + match[1].length; // skip the boundary char
      if (emailRanges.some((range) => range.from <= start && start < range.to)) continue;
      ranges.push({ from: start, to: start + 1 + match[2].length, deco: mentionMark });
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) builder.add(r.from, r.to, r.deco);
  return builder.finish();
}

export const tagMentionDecorations = viewportDecorations(build);
