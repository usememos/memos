import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

export type UploadAnchorStatus = "uploading" | "failed";

export interface UploadAnchorDescriptor {
  id: string;
  status: UploadAnchorStatus;
  completed: number;
  total: number;
  message: string;
  retryLabel: string;
  keepLabel: string;
  onRetry?: () => void;
  onKeepAttachments?: () => void;
}

const addUploadAnchor = StateEffect.define<{ position: number; descriptor: UploadAnchorDescriptor }>();
const updateUploadAnchor = StateEffect.define<UploadAnchorDescriptor>();
const removeUploadAnchor = StateEffect.define<string>();

class UploadAnchorWidget extends WidgetType {
  constructor(readonly descriptor: UploadAnchorDescriptor) {
    super();
  }

  // Every field below is rendered by toDOM — the labels as text, the callbacks as
  // click listeners baked into the reused element — so all of them have to take
  // part in the comparison. Returning true for a descriptor that differs only in
  // its callbacks would leave the previous handlers wired to the old DOM.
  eq(other: UploadAnchorWidget): boolean {
    const [a, b] = [this.descriptor, other.descriptor];
    return (
      a.id === b.id &&
      a.status === b.status &&
      a.completed === b.completed &&
      a.total === b.total &&
      a.message === b.message &&
      a.retryLabel === b.retryLabel &&
      a.keepLabel === b.keepLabel &&
      a.onRetry === b.onRetry &&
      a.onKeepAttachments === b.onKeepAttachments
    );
  }

  toDOM(): HTMLElement {
    const root = document.createElement("div");
    root.className = "cm-upload-anchor";
    root.dataset.status = this.descriptor.status;
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");

    const rail = document.createElement("span");
    rail.className = "cm-upload-anchor-rail";
    root.appendChild(rail);

    const badge = document.createElement("span");
    badge.className = "cm-upload-anchor-badge";
    if (this.descriptor.status === "uploading") {
      const spinner = document.createElement("span");
      spinner.className = "cm-upload-anchor-spinner";
      spinner.setAttribute("aria-hidden", "true");
      badge.appendChild(spinner);
      badge.append(this.descriptor.message);
    } else {
      badge.append(this.descriptor.message);
    }
    root.appendChild(badge);

    if (this.descriptor.status === "failed") {
      const actions = document.createElement("span");
      actions.className = "cm-upload-anchor-actions";
      if (this.descriptor.onRetry) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "cm-upload-anchor-action";
        retry.textContent = this.descriptor.retryLabel;
        retry.addEventListener("click", this.descriptor.onRetry);
        actions.appendChild(retry);
      }
      if (this.descriptor.onKeepAttachments) {
        const keep = document.createElement("button");
        keep.type = "button";
        keep.className = "cm-upload-anchor-action";
        keep.textContent = this.descriptor.keepLabel;
        keep.addEventListener("click", this.descriptor.onKeepAttachments);
        actions.appendChild(keep);
      }
      root.appendChild(actions);
    }

    return root;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const anchorIdOf = (value: Decoration): string | undefined =>
  value.spec.widget instanceof UploadAnchorWidget ? value.spec.widget.descriptor.id : undefined;

const findAnchorPosition = (decorations: DecorationSet, id: string): number | undefined => {
  let position: number | undefined;
  decorations.between(0, Number.MAX_SAFE_INTEGER, (from, _to, value) => {
    if (anchorIdOf(value) === id) {
      position = from;
    }
  });
  return position;
};

export const uploadAnchorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (anchors, transaction) => {
    let next = anchors.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(addUploadAnchor)) {
        const position = Math.min(Math.max(effect.value.position, 0), transaction.state.doc.length);
        next = next.update({
          add: [Decoration.widget({ widget: new UploadAnchorWidget(effect.value.descriptor), side: 1, block: true }).range(position)],
          sort: true,
        });
      } else if (effect.is(updateUploadAnchor)) {
        const position = findAnchorPosition(next, effect.value.id);
        if (position === undefined) continue;
        next = next.update({
          filter: (_from, _to, value) => anchorIdOf(value) !== effect.value.id,
          add: [Decoration.widget({ widget: new UploadAnchorWidget(effect.value), side: 1, block: true }).range(position)],
          sort: true,
        });
      } else if (effect.is(removeUploadAnchor)) {
        next = next.update({
          filter: (_from, _to, value) => anchorIdOf(value) !== effect.value,
        });
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const createUploadAnchor = (view: EditorView, descriptor: UploadAnchorDescriptor, position?: number): void => {
  view.dispatch({ effects: addUploadAnchor.of({ position: position ?? view.state.selection.main.head, descriptor }) });
};

export const setUploadAnchor = (view: EditorView, descriptor: UploadAnchorDescriptor): void => {
  view.dispatch({ effects: updateUploadAnchor.of(descriptor) });
};

export const cancelUploadAnchor = (view: EditorView, id: string): void => {
  view.dispatch({ effects: removeUploadAnchor.of(id) });
};

export const getUploadAnchorPosition = (state: EditorState, id: string): number | undefined =>
  findAnchorPosition(state.field(uploadAnchorField, false) ?? Decoration.none, id);

export const removeUploadAnchorEffect = (id: string): StateEffect<string> => removeUploadAnchor.of(id);
