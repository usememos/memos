import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { type HeadingLevel, headingTypeClass } from "@/lib/markdownStyles";
import { HEADING_LINE } from "./formatting";
import { viewportDecorations } from "./viewportDecorations";

// Heading type comes from the same token as the read-only view, so a heading
// keeps its size and weight when the memo is saved.
const lineDecorations = ([1, 2, 3, 4, 5, 6] as const).map((level: HeadingLevel) =>
  Decoration.line({ class: `cm-md-h${level} ${headingTypeClass(level)}` }),
);

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from).number;
    const endLine = view.state.doc.lineAt(to).number;
    for (let n = startLine; n <= endLine; n++) {
      const line = view.state.doc.line(n);
      const m = HEADING_LINE.exec(line.text);
      if (m) {
        builder.add(line.from, line.from, lineDecorations[m[1].length - 1]);
      }
    }
  }
  return builder.finish();
}

export const headingDecorations = viewportDecorations(build);
