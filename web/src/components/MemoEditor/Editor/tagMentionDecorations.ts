import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { MENTION_RUN } from "@/utils/mention-grammar";
import { TAG_RUN } from "@/utils/tag-grammar";
import { viewportDecorations } from "./viewportDecorations";

const TAG_RE = new RegExp(`(^|[^\\p{L}\\p{N}])#(${TAG_RUN})`, "gu");
const MENTION_RE = new RegExp(`(^|[^A-Za-z0-9])@(${MENTION_RUN})`, "gu");
const tagMark = Decoration.mark({ class: "cm-memo-tag" });
const mentionMark = Decoration.mark({ class: "cm-memo-mention" });

function build(view: EditorView): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const [re, deco] of [
      [TAG_RE, tagMark],
      [MENTION_RE, mentionMark],
    ] as const) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = from + m.index + m[1].length; // skip the boundary char
        ranges.push({ from: start, to: start + 1 + m[2].length, deco });
      }
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) builder.add(r.from, r.to, r.deco);
  return builder.finish();
}

export const tagMentionDecorations = viewportDecorations(build);
