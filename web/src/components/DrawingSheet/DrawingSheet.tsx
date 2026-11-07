import { type CanvasError, type CanvasHandle, drawingFileName, type Scene, type ToolName } from "@usememos/canvas";
import { Canvas } from "@usememos/canvas/react";
import { AlertDialog, Button, Dialog, Popover, Toggle, ToggleGroup, Tooltip } from "@usememos/ui";
import {
  CircleIcon,
  EraserIcon,
  ImagePlusIcon,
  MousePointer2Icon,
  MoveUpRightIcon,
  PencilIcon,
  Redo2Icon,
  ScanIcon,
  SquareIcon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import { type ClipboardEvent, type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import useMediaQuery from "@/hooks/useMediaQuery";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type Translations, useTranslate } from "@/utils/i18n";
import { primaryModifierGlyph } from "@/utils/platform";
import { DRAWING_HUES, useCanvasTheme } from "./useCanvasTheme";

const TOOLS: { name: ToolName; label: Translations; shortcut: string; icon: ReactElement }[] = [
  { name: "select", label: "editor.drawing.tool-select", shortcut: "V", icon: <MousePointer2Icon /> },
  { name: "pen", label: "editor.drawing.tool-pen", shortcut: "P", icon: <PencilIcon /> },
  { name: "eraser", label: "editor.drawing.tool-eraser", shortcut: "E", icon: <EraserIcon /> },
  { name: "rectangle", label: "editor.drawing.tool-rectangle", shortcut: "R", icon: <SquareIcon /> },
  { name: "ellipse", label: "editor.drawing.tool-ellipse", shortcut: "O", icon: <CircleIcon /> },
  { name: "arrow", label: "editor.drawing.tool-arrow", shortcut: "A", icon: <MoveUpRightIcon /> },
  { name: "text", label: "editor.drawing.tool-text", shortcut: "T", icon: <TypeIcon /> },
];
// One stable list, so the canvas does not reset its tools on every render.
const TOOL_NAMES = TOOLS.map((tool) => tool.name);

const WIDTHS: { value: number; label: Translations }[] = [
  { value: 1, label: "editor.drawing.width-thin" },
  { value: 2, label: "editor.drawing.width-medium" },
  { value: 4, label: "editor.drawing.width-thick" },
];

export interface DrawingSheetProps {
  /** `edit` reopens a saved drawing; it changes the sheet's name and the discard prompt. */
  mode: "new" | "edit";
  /** The scene read from the drawing's original file. */
  initialScene?: Scene;
  /** A picture to draw on: a file named like a drawing whose scene could not be read. */
  background?: Blob;
  /** The finished drawing, a PNG with the scene embedded, named `drawing-YYYYMMDD-HHMMSS.canvas.png`. */
  onDone: (file: File) => void;
  onClose: () => void;
}

/**
 * The full-screen drawing sheet over the editor. `@usememos/canvas` draws and edits the
 * scene; everything around it (the bars, strings, theme, discard prompt) is memos'. On a
 * phone the tools move to a bottom bar, in thumb reach, with each control 44 px apart.
 */
const DrawingSheet = ({ mode, initialScene, background, onDone, onClose }: DrawingSheetProps) => {
  const t = useTranslate();
  const isWide = useMediaQuery("sm");
  const { theme, ink, fontFamily } = useCanvasTheme();
  const canvasRef = useRef<CanvasHandle | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<ToolName>("pen");
  const [history, setHistory] = useState({ undo: false, redo: false });
  // Null follows the theme's ink, so a drawing started in one theme keeps reading in the other.
  const [color, setColor] = useState<string | null>(null);
  const [width, setWidth] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const title = t(mode === "edit" ? "editor.drawing.edit" : "editor.drawing.new-title");
  const currentColor = color ?? ink;

  // Runs once the canvas has mounted (see CanvasMounted): the pen is ready, and a
  // picture without a scene becomes the drawing's locked background.
  const setUpCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setTool("pen");
    if (!background) return;
    canvas
      .insertImage(background, { background: true })
      .then(() => {
        // The picture is where the drawing starts, not a change to discard.
        canvas.markSaved();
        canvas.zoomToFit();
      })
      .catch(() => showErrorToast(t("editor.drawing.image-failed")));
  };

  const syncHistory = () => {
    const canvas = canvasRef.current;
    setHistory({ undo: Boolean(canvas?.canUndo()), redo: Boolean(canvas?.canRedo()) });
  };

  const handleCanvasError = (error: CanvasError) => {
    if (error.operation === "insert-image" || error.operation === "load-image") showErrorToast(t("editor.drawing.image-failed"));
    else if (error.operation === "export-png") showErrorToast(t("editor.drawing.export-failed"));
    // A face of the UI font stack that cannot load (a local() alias, say) falls back to the
    // next one in the stack; nothing for the person to act on.
  };

  const chooseTool = (next: ToolName) => {
    setTool(next);
    canvasRef.current?.setTool(next);
  };

  const applyWidth = (strokeWidth: number) => {
    canvasRef.current?.setStyle({ strokeWidth });
    setWidth(strokeWidth);
  };

  const insertImages = (files: File[]) => {
    for (const file of files.filter((candidate) => candidate.type.startsWith("image/"))) {
      canvasRef.current?.insertImage(file).catch(() => showErrorToast(t("editor.drawing.image-failed")));
    }
  };

  // The drawing surface inserts pasted pictures itself; a paste anywhere else on the sheet lands there too.
  const handlePaste = (event: ClipboardEvent) => {
    if (surfaceRef.current?.contains(event.target as Node)) return;
    insertImages(Array.from(event.clipboardData.files));
  };

  // Cancel, Escape and the system back gesture all ask first when the drawing has changes.
  const requestClose = () => {
    if (canvasRef.current?.isDirty()) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleDone = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExporting) return;
    // Text still being typed is part of the drawing.
    canvas.commitText();
    setIsExporting(true);
    try {
      const blob = await canvas.exportPng();
      canvas.markSaved();
      onDone(new File([blob], drawingFileName(), { type: "image/png" }));
    } catch (error) {
      console.error(error);
      showErrorToast(t("editor.drawing.export-failed"));
    } finally {
      setIsExporting(false);
    }
  };

  const toolRow = (
    <div role="group" aria-label={t("editor.drawing.tools")} className={cn("flex items-center", isWide ? "gap-0.5" : "gap-3")}>
      {TOOLS.map((item) => (
        <Tooltip.Root key={item.name}>
          <Tooltip.Trigger
            render={
              <Toggle
                aria-label={t(item.label)}
                icon={item.icon}
                pressed={tool === item.name}
                onPressedChange={() => chooseTool(item.name)}
              />
            }
          />
          <Tooltip.Popup shortcut={item.shortcut}>{t(item.label)}</Tooltip.Popup>
        </Tooltip.Root>
      ))}
    </div>
  );

  const swatches = [{ key: "ink", value: ink }, ...DRAWING_HUES.map((hue) => ({ key: hue.key, value: hue.value }))] as const;
  const styleControl = (
    <Popover.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              render={
                <Button
                  variant="ghost"
                  aria-label={t("editor.drawing.style")}
                  icon={<CircleIcon style={{ color: currentColor, fill: currentColor }} />}
                />
              }
            />
          }
        />
        <Tooltip.Popup>{t("editor.drawing.style")}</Tooltip.Popup>
      </Tooltip.Root>
      <Popover.Popup side={isWide ? "bottom" : "top"} aria-label={t("editor.drawing.style")}>
        <div className="flex flex-col gap-2">
          <span className="mu-label-sm text-mu-ink-muted">{t("editor.drawing.color")}</span>
          <div
            role="group"
            aria-label={t("editor.drawing.color")}
            className={cn("grid justify-items-start", isWide ? "grid-cols-8 gap-0.5" : "grid-cols-4 gap-3")}
          >
            {swatches.map((swatch) => (
              <Tooltip.Root key={swatch.key}>
                <Tooltip.Trigger
                  render={
                    <Toggle
                      aria-label={t(`editor.drawing.color-${swatch.key}`)}
                      pressed={currentColor.toLowerCase() === swatch.value.toLowerCase()}
                      onPressedChange={() => {
                        canvasRef.current?.setStyle({ strokeColor: swatch.value });
                        setColor(swatch.key === "ink" ? null : swatch.value);
                      }}
                      icon={<CircleIcon style={{ color: swatch.value, fill: swatch.value }} />}
                    />
                  }
                />
                <Tooltip.Popup>{t(`editor.drawing.color-${swatch.key}`)}</Tooltip.Popup>
              </Tooltip.Root>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="mu-label-sm text-mu-ink-muted">{t("editor.drawing.width")}</span>
          <ToggleGroup
            fullWidth
            aria-label={t("editor.drawing.width")}
            value={[String(width)]}
            onValueChange={([next]) => next && applyWidth(Number(next))}
          >
            {WIDTHS.map((option) => (
              <Toggle key={option.value} value={String(option.value)}>
                {t(option.label)}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      </Popover.Popup>
    </Popover.Root>
  );

  const modifier = primaryModifierGlyph();
  const historyControls = (
    <>
      <IconAction
        label={t("editor.drawing.undo")}
        shortcut={`${modifier} Z`}
        icon={<Undo2Icon />}
        disabled={!history.undo}
        onClick={() => {
          canvasRef.current?.undo();
          syncHistory();
        }}
      />
      <IconAction
        label={t("editor.drawing.redo")}
        shortcut={`⇧ ${modifier} Z`}
        icon={<Redo2Icon />}
        disabled={!history.redo}
        onClick={() => {
          canvasRef.current?.redo();
          syncHistory();
        }}
      />
    </>
  );
  const viewControls = (
    <>
      <IconAction label={t("editor.drawing.zoom-to-fit")} icon={<ScanIcon />} onClick={() => canvasRef.current?.zoomToFit()} />
      <IconAction label={t("editor.insert-menu.insert-image")} icon={<ImagePlusIcon />} onClick={() => fileInputRef.current?.click()} />
    </>
  );
  const cancelButton = (
    <Button variant="ghost" onClick={requestClose}>
      {t("common.cancel")}
    </Button>
  );
  const doneButton = (
    <Button variant="primary" onClick={handleDone} loading={isExporting} loadingLabel={t("editor.drawing.done")}>
      {t("editor.drawing.done")}
    </Button>
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        // The sheet closes only through requestClose, which asks first when there are changes.
        eventDetails.cancel();
        // Escape on the drawing surface leaves the current tool or selection; it belongs to the canvas.
        const escapeOnSurface = eventDetails.reason === "escape-key" && surfaceRef.current?.contains(eventDetails.event.target as Node);
        if (!escapeOnSurface) requestClose();
      }}
    >
      <Dialog.Popup variant="bare" fullScreen aria-label={title}>
        <div className="flex h-full w-full flex-col bg-mu-surface" onPaste={handlePaste}>
          <Dialog.Title className="mu-visually-hidden">{title}</Dialog.Title>
          {isWide ? (
            <Bar edge="top">
              <div className="flex min-w-0 flex-1 items-center">{cancelButton}</div>
              <div className="flex shrink-0 items-center gap-0.5">
                {toolRow}
                <Divider />
                {styleControl}
                <Divider />
                {historyControls}
                <Divider />
                {viewControls}
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end">{doneButton}</div>
            </Bar>
          ) : (
            <Bar edge="top">
              {cancelButton}
              <div className="flex items-center gap-3">
                {historyControls}
                {viewControls}
              </div>
              {doneButton}
            </Bar>
          )}

          {/* Undo and redo follow every gesture and shortcut as it ends; onChange alone is debounced. */}
          <div ref={surfaceRef} className="relative min-h-0 flex-1" onPointerUp={syncHistory} onKeyUp={syncHistory}>
            <Canvas
              ref={canvasRef}
              className="absolute inset-0"
              autoFocus
              ariaLabel={title}
              initialScene={initialScene}
              theme={theme}
              tools={TOOL_NAMES}
              fontFamily={fontFamily}
              onChange={syncHistory}
              onToolChange={setTool}
              onError={handleCanvasError}
            />
            <CanvasMounted onMounted={setUpCanvas} />
          </div>

          {!isWide && (
            <Bar edge="bottom">
              {toolRow}
              <Divider />
              {styleControl}
            </Bar>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              insertImages(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>

        <AlertDialog.Root open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialog.Popup>
            <AlertDialog.Title>
              {t(mode === "edit" ? "editor.drawing.discard-edit-title" : "editor.drawing.discard-title")}
            </AlertDialog.Title>
            <AlertDialog.Description>
              {t(mode === "edit" ? "editor.drawing.discard-edit-description" : "editor.drawing.discard-description")}
            </AlertDialog.Description>
            <AlertDialog.Footer>
              <AlertDialog.Close render={<Button variant="ghost">{t("editor.drawing.keep-drawing")}</Button>} />
              <Button
                variant="danger"
                onClick={() => {
                  setDiscardOpen(false);
                  onClose();
                }}
              >
                {t("editor.drawing.discard")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Popup>
        </AlertDialog.Root>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

/**
 * Calls back once, after the canvas beside it has mounted. The canvas creates its engine in
 * a layout effect inside the dialog's portal, which mounts after the sheet's own effects;
 * a sibling's passive effect runs after every layout effect, so the handle is live by then.
 */
const CanvasMounted = ({ onMounted }: { onMounted: () => void }) => {
  const callback = useRef(onMounted);
  useEffect(() => {
    callback.current();
  }, []);
  return null;
};

/** An icon-only ghost Button named by its Tooltip, as every icon control in memos. */
const IconAction = ({
  label,
  icon,
  shortcut,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactElement;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger render={<Button variant="ghost" aria-label={label} icon={icon} disabled={disabled} onClick={onClick} />} />
    <Tooltip.Popup shortcut={shortcut}>{label}</Tooltip.Popup>
  </Tooltip.Root>
);

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-mu-line" />;

/** The sheet's chrome recedes: the paper's own color, a hairline, safe-area aware. */
const Bar = ({ edge, children }: { edge: "top" | "bottom"; children: ReactNode }) => (
  <div
    className={cn(
      "flex w-full shrink-0 items-center gap-2 bg-mu-surface px-3",
      edge === "top"
        ? "h-[calc(52px+env(safe-area-inset-top))] justify-between border-b border-mu-line pt-[env(safe-area-inset-top)]"
        : "h-[calc(56px+env(safe-area-inset-bottom))] justify-center border-t border-mu-line pb-[env(safe-area-inset-bottom)]",
    )}
  >
    {children}
  </div>
);

export default DrawingSheet;
