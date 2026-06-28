import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { viewportDecorations } from "./viewportDecorations";

// A heading is a line that starts with 1-6 hashes followed by a space or tab.
// A bare "#" or a "#tag" (no space) is intentionally NOT a heading.
const HEADING_RE = /^(#{1,6})[ \t]/;

const lineDecorations = [1, 2, 3, 4, 5, 6].map((level) => Decoration.line({ class: `cm-md-h${level}` }));

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from).number;
    const endLine = view.state.doc.lineAt(to).number;
    for (let n = startLine; n <= endLine; n++) {
      const line = view.state.doc.line(n);
      const m = HEADING_RE.exec(line.text);
      if (m) {
        builder.add(line.from, line.from, lineDecorations[m[1].length - 1]);
      }
    }
  }
  return builder.finish();
}

export const headingDecorations = viewportDecorations(build);
