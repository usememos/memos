import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { userServiceClient } from "@/connect";
import { downloadFileFromUrl } from "@/lib/browser";
import type { ImportMemosPlan, ImportMemosReport, ImportMemosRequest } from "@/types/proto/api/user_service_pb";
import { ImportMemosRequest_ConflictPolicy, ImportMemosSpecSchema } from "@/types/proto/api/user_service_pb";

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;

// MemoExportError is a refused export preflight, carrying the HTTP status so
// the caller can tell a busy server (429) from a denied request.
export class MemoExportError extends Error {
  constructor(readonly status: number) {
    super(`Export refused with status ${status}`);
    this.name = "MemoExportError";
  }
}

export const memoExportUrl = (username: string) => `/file/users/${encodeURIComponent(username)}/export`;

const filenameFromDisposition = (disposition: string | null): string | undefined => {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // A plain filename may hold a literal percent sign; keep it as sent.
    return match[1];
  }
};

// exportMemos downloads a user's Memos export file. The archive streams from
// the file server straight into the browser's download, so it is never held
// in page memory. A HEAD preflight runs the server's checks first, so a
// refusal arrives as an error instead of a downloaded error document.
export async function exportMemos(username: string): Promise<void> {
  const url = memoExportUrl(username);
  const response = await fetch(url, { method: "HEAD", credentials: "same-origin" });
  if (!response.ok) {
    throw new MemoExportError(response.status);
  }
  downloadFileFromUrl(url, filenameFromDisposition(response.headers.get("Content-Disposition")) ?? `memos-export-${username}.zip`);
}

export interface StagedMemoImport {
  uploadId: string;
  size: number;
  plan: ImportMemosPlan;
}

async function sendChunk(request: ImportMemosRequest, signal?: AbortSignal) {
  // Retrying the identical last write is safe even if its response was lost.
  for (let attempt = 0; ; attempt++) {
    try {
      return await userServiceClient.importMemos(request, { signal });
    } catch (error) {
      if (signal?.aborted || ConnectError.from(error).code !== Code.Unavailable || attempt >= 2) throw error;
    }
  }
}

// stageMemoImport uploads the archive in chunks and finishes with
// validate_only, returning the staged upload and the server's plan.
export async function stageMemoImport(userName: string, file: File, signal?: AbortSignal): Promise<StagedMemoImport> {
  const spec = create(ImportMemosSpecSchema, { totalSize: BigInt(file.size) });
  const initial = await userServiceClient.importMemos({ name: userName, upload: { case: "spec", value: spec } }, { signal });
  if (!initial.uploadId || initial.committedSize !== 0n || initial.maxChunkSize <= 0) {
    throw new Error("Invalid upload initialization response");
  }
  const chunkSize = Math.min(initial.maxChunkSize, DEFAULT_CHUNK_SIZE);
  for (let offset = 0; ; ) {
    signal?.throwIfAborted();
    const end = Math.min(offset + chunkSize, file.size);
    const response = await sendChunk(
      {
        name: userName,
        upload: { case: "uploadId", value: initial.uploadId },
        writeOffset: BigInt(offset),
        data: new Uint8Array(await file.slice(offset, end).arrayBuffer()),
        finishWrite: end === file.size,
        validateOnly: true,
      } as ImportMemosRequest,
      signal,
    );
    if (response.committedSize !== BigInt(end)) {
      throw new Error("Unexpected upload offset");
    }
    if (end === file.size) {
      if (response.result.case !== "plan") throw new Error("Upload finished without a plan");
      return { uploadId: initial.uploadId, size: file.size, plan: response.result.value };
    }
    offset = end;
  }
}

// importStagedMemos imports a staged archive with the chosen policy.
export async function importStagedMemos(
  userName: string,
  staged: StagedMemoImport,
  conflictPolicy: ImportMemosRequest_ConflictPolicy,
): Promise<ImportMemosReport> {
  const response = await userServiceClient.importMemos({
    name: userName,
    upload: { case: "uploadId", value: staged.uploadId },
    writeOffset: BigInt(staged.size),
    finishWrite: true,
    conflictPolicy,
  });
  if (response.result.case !== "report") throw new Error("Import finished without a report");
  return response.result.value;
}
