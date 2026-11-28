import "@excalidraw/excalidraw/index.css";
import {
  Excalidraw,
  exportToBlob,
  getNonDeletedElements,
  getSceneVersion,
  languages,
  loadFromBlob,
  MainMenu,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { AlertDialog, Button, Spinner } from "@usememos/ui";
import { FolderOpenIcon, XIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { showErrorToast } from "@/lib/toast";
import type { Translations } from "@/utils/i18n";
import { useTranslate } from "@/utils/i18n";
import {
  EXCALIDRAW_EXTENSION,
  EXCALIDRAW_MIME_TYPE,
  ExcalidrawActionError,
  type ExcalidrawFiles,
  type ExcalidrawSceneData,
  excalidrawPreviewFilename,
  parseExcalidrawFile,
} from "./excalidraw";

export interface ExcalidrawSheetProps {
  /** The scene to open; a new drawing starts empty. */
  initialScene?: ExcalidrawSceneData;
  /** Still fetching the scene: the sheet shows a spinner instead of the canvas. */
  loading?: boolean;
  /** The source file's name; a file opened from disk brings its own. */
  filename: string;
  mode: "new" | "edit";
  /** Throwing keeps the sheet open with the drawing, so Save retries. */
  onSave: (files: ExcalidrawFiles) => Promise<void> | void;
  onClose: () => void;
}

/** Excalidraw's language closest to memos', or its default. */
const useExcalidrawLangCode = () => {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const exact = languages.find((lang) => lang.code.toLowerCase() === language.toLowerCase());
  const base = language.split("-")[0].toLowerCase();
  return (exact ?? languages.find((lang) => lang.code.split("-")[0].toLowerCase() === base))?.code ?? "en";
};

const toInitialData = (scene?: ExcalidrawSceneData): ExcalidrawInitialDataState | null =>
  scene
    ? ({
        elements: scene.elements,
        appState: scene.appState,
        files: scene.files,
        scrollToContent: true,
      } as ExcalidrawInitialDataState)
    : null;

/**
 * The Excalidraw editor, over the whole window. Saving turns the scene into its two files: the
 * `.excalidraw` source, which keeps embedded images, and the PNG the memo's gallery shows.
 * The sheet lives in its own layer above the app, since Excalidraw portals its menus and dialogs
 * to the document body, where a modal dialog would make them inert.
 */
const ExcalidrawSheet = ({ initialScene, loading = false, filename: initialFilename, mode, onSave, onClose }: ExcalidrawSheetProps) => {
  const t = useTranslate();
  const theme = useResolvedTheme() === "default-dark" ? "dark" : "light";
  const langCode = useExcalidrawLangCode();
  const [api, setApi] = useState<ExcalidrawImperativeAPI>();
  const [filename, setFilename] = useState(initialFilename);
  const [hasContent, setHasContent] = useState(Boolean(initialScene?.elements.length));
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const baselineVersion = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The sheet covers the page; the page stops scrolling under it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const isDirty = () => {
    if (!api) return false;
    const version = getSceneVersion(api.getSceneElementsIncludingDeleted());
    return baselineVersion.current !== undefined && version !== baselineVersion.current;
  };

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty()) setDiscardOpen(true);
    else onClose();
  };

  const handleSave = async () => {
    if (!api || isSaving) return;
    const elements = getNonDeletedElements(api.getSceneElements());
    if (elements.length === 0) return;
    setIsSaving(true);
    try {
      const appState = api.getAppState();
      const files = api.getFiles();
      let preview: Blob;
      try {
        preview = await exportToBlob({
          elements,
          appState: { ...appState, exportBackground: true },
          files,
          mimeType: "image/png",
          exportPadding: 16,
        });
      } catch (error) {
        console.error(error);
        throw new ExcalidrawActionError("editor.excalidraw.save-failed");
      }
      const source = new File([serializeAsJSON(elements, appState, files, "local")], filename, { type: EXCALIDRAW_MIME_TYPE });
      await onSave({ source, preview: new File([preview], excalidrawPreviewFilename(filename), { type: "image/png" }) });
    } catch (error) {
      console.error(error);
      showErrorToast(t(error instanceof ExcalidrawActionError ? error.label : "editor.excalidraw.save-failed"));
    } finally {
      setIsSaving(false);
    }
  };

  // A file from disk replaces the canvas and lends its name to the source.
  const handleOpenFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !api) return;
    try {
      parseExcalidrawFile(await file.text());
      const scene = await loadFromBlob(file, api.getAppState(), api.getSceneElements());
      api.updateScene({ elements: scene.elements, appState: { ...scene.appState, theme } });
      const files = Object.values(scene.files ?? {});
      if (files.length > 0) api.addFiles(files);
      api.scrollToContent(undefined, { fitToContent: true });
      setFilename(file.name.toLowerCase().endsWith(EXCALIDRAW_EXTENSION) ? file.name : `${file.name}${EXCALIDRAW_EXTENSION}`);
    } catch (error) {
      console.error(error);
      showErrorToast(t("editor.excalidraw.invalid-file"));
    }
  };

  const title: Translations = mode === "edit" ? "editor.excalidraw.edit" : "editor.excalidraw.new";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(title)}
      className="fixed inset-0 z-50 flex flex-col bg-mu-canvas"
      onKeyDown={(event) => {
        // Escape inside the canvas leaves a tool or selection first; Excalidraw handles it.
        if (event.key === "Escape" && !(event.target as HTMLElement).closest(".excalidraw")) requestClose();
      }}
    >
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label={t("editor.blocks.loading")} />
          </div>
        ) : (
          <Excalidraw
            excalidrawAPI={setApi}
            initialData={toInitialData(initialScene)}
            onChange={(elements) => {
              // Excalidraw restores the opened scene before it reports a change, so the first
              // scene it reports is the one the drawing was opened with.
              baselineVersion.current ??= getSceneVersion(elements);
              setHasContent(getNonDeletedElements(elements).length > 0);
            }}
            theme={theme}
            langCode={langCode}
            name={filename.slice(0, -EXCALIDRAW_EXTENSION.length) || filename}
            autoFocus
            UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: null } }}
            renderTopRightUI={() => (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  disabled={isSaving}
                  onClick={requestClose}
                  aria-label={t("common.close")}
                  icon={<XIcon />}
                />
                <Button
                  variant="primary"
                  size="md"
                  disabled={!hasContent}
                  loading={isSaving}
                  loadingLabel={t(mode === "edit" ? "common.save" : "common.add")}
                  onClick={handleSave}
                >
                  {t(mode === "edit" ? "common.save" : "common.add")}
                </Button>
              </div>
            )}
          >
            <MainMenu>
              <MainMenu.Item icon={<FolderOpenIcon className="mu-icon" />} onSelect={() => fileInputRef.current?.click()}>
                {t("editor.excalidraw.open-file")}
              </MainMenu.Item>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.DefaultItems.Help />
            </MainMenu>
          </Excalidraw>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={`${EXCALIDRAW_EXTENSION},${EXCALIDRAW_MIME_TYPE},application/json`}
        className="hidden"
        onChange={handleOpenFile}
      />

      <AlertDialog.Root open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialog.Popup>
          <AlertDialog.Title>{t(mode === "edit" ? "editor.drawing.discard-edit-title" : "editor.drawing.discard-title")}</AlertDialog.Title>
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
    </div>,
    document.body,
  );
};

export default ExcalidrawSheet;
