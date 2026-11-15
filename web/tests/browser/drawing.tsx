import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createScene, insertSceneChunk, readScenePng, type Scene } from "@usememos/canvas";
import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import DrawingSheet from "@/components/DrawingSheet/DrawingSheet";
import DrawingViewer from "@/components/DrawingSheet/DrawingViewer";
import { useBlobUrls } from "@/components/MemoEditor/edit/hooks/useBlobUrls";
import { useDrawing } from "@/components/MemoEditor/edit/hooks/useDrawing";
import {
  createInitialState,
  EditorProvider,
  type EditorStore,
  useEditorSelector,
  useEditorStore,
} from "@/components/MemoEditor/edit/state";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";
import { UserSchema } from "@/types/proto/api/user_service_pb";
import "@/index.css";

declare global {
  interface Window {
    drawingTest: {
      store: EditorStore;
      readScenePng: typeof readScenePng;
    };
  }
}

const image = document.createElement("canvas");
image.width = 1000;
image.height = 600;
const context = image.getContext("2d");
if (!context) throw new Error("Canvas unavailable");
context.fillStyle = "white";
context.fillRect(0, 0, 1000, 600);
context.fillStyle = "black";
context.font = "30px sans-serif";
context.fillText("Original screenshot", 80, 80);
context.strokeRect(80, 140, 400, 200);
const source = await new Promise<Blob>((resolve, reject) =>
  image.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG failed")))),
);
const savedScene: Scene = {
  ...createScene("#fbfaf7"),
  elements: [
    {
      id: "existing-rectangle",
      type: "rectangle",
      x: 600,
      y: 350,
      width: 240,
      height: 100,
      angle: 0,
      strokeColor: "#1a1a1a",
      backgroundColor: "transparent",
      strokeWidth: 2,
      opacity: 100,
      roundness: 0,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      seed: 1,
      locked: false,
    },
  ],
};
const savedDrawing = new File(
  [new Uint8Array(await insertSceneChunk(new Uint8Array(await source.arrayBuffer()), savedScene))],
  "saved.canvas.png",
  { type: "image/png" },
);
const drawingUrl = URL.createObjectURL(savedDrawing);
const initial = createInitialState();
initial.content = "Fresh editor";
initial.localFiles = [
  { file: new File([source], "original.png", { type: "image/png" }), previewUrl: URL.createObjectURL(source) },
  { file: new File(["other file bytes"], "other.txt"), previewUrl: URL.createObjectURL(new Blob(["other file bytes"])) },
];

function DrawingHost() {
  const [viewing, setViewing] = useState(false);
  const store = useEditorStore();
  const content = useEditorSelector((state) => state.content);
  const files = useEditorSelector((state) => state.localFiles);
  const { createBlobUrl } = useBlobUrls();
  const drawing = useDrawing((file) => ({ file, previewUrl: createBlobUrl(file) }));
  window.drawingTest = { store, readScenePng };
  return (
    <>
      <textarea
        aria-label="Memo text"
        value={content}
        onChange={(event) => store.dispatch(store.actions.updateContent(event.target.value))}
      />
      <button type="button" onClick={() => void drawing.openExisting({ kind: "local", localFile: files[0] })}>
        Annotate source
      </button>
      <button type="button" onClick={() => setViewing(true)}>
        View markup
      </button>
      <button
        type="button"
        onClick={() => void drawing.openExisting({ kind: "local", localFile: { file: savedDrawing, previewUrl: drawingUrl } })}
      >
        Edit saved markup
      </button>
      {viewing && (
        <DrawingViewer
          attachment={create(AttachmentSchema, {
            name: "attachments/drawing",
            creator: "users/browser",
            filename: "fixture.canvas.png",
            externalLink: drawingUrl,
          })}
          memo={create(MemoSchema, { name: "memos/drawing", creator: "users/browser" })}
          canEdit
          onClose={() => setViewing(false)}
          onNoScene={() => {
            throw new Error("Missing fixture scene");
          }}
        />
      )}
      {drawing.session && (
        <Suspense fallback={null}>
          <DrawingSheet
            key={drawing.session.id}
            mode={drawing.session.mode}
            initialScene={drawing.session.scene}
            background={drawing.session.background}
            onDone={drawing.done}
            onClose={drawing.close}
          />
        </Suspense>
      )}
    </>
  );
}
function App() {
  const { currentUser, setCurrentUser } = useAuth();
  useEffect(() => {
    setCurrentUser(create(UserSchema, { name: "users/browser" }));
  }, [setCurrentUser]);
  return currentUser ? (
    <EditorProvider initialEditorState={initial}>
      <DrawingHost />
    </EditorProvider>
  ) : null;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>,
);
