import { describe, expect, it } from "vitest";
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { Code } from "@connectrpc/connect";
import worker from "../src/index";
import type { Env } from "../src/env";
import { AttachmentService } from "../src/gen/api/v1/attachment_service_pb";
import { AuthService } from "../src/gen/api/v1/auth_service_pb";
import { MemoService, Visibility } from "../src/gen/api/v1/memo_service_pb";
import { makeClient } from "./helpers";

const ALICE = "alice@example.com";
const BOB = "bob@example.com";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

(env as { ADMIN_EMAILS: string }).ADMIN_EMAILS = "";

async function provision(email: string): Promise<void> {
  await makeClient(AuthService, email).getCurrentUser({});
}

// Fetches a /file URL as the given user (via DEV_USER_EMAIL) or anonymously.
// Buffers the body: an unconsumed R2 stream keeps a storage handle open and
// breaks vitest-pool-workers isolated storage.
async function fetchFile(path: string, email: string): Promise<Response> {
  const testEnv: Env = { ...(env as unknown as Env), DEV_USER_EMAIL: email };
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`http://localhost${path}`), testEnv, ctx);
  const body = await response.arrayBuffer();
  await waitOnExecutionContext(ctx);
  return new Response(body, { status: response.status, headers: response.headers });
}

describe("AttachmentService + /file", () => {
  it("uploads to R2 and serves the file back with access control", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(AttachmentService, ALICE);
    const memoClient = makeClient(MemoService, ALICE);

    const memo = await memoClient.createMemo({ memo: { content: "с картинкой", visibility: Visibility.PRIVATE } });
    const attachment = await alice.createAttachment({
      attachment: { filename: "pic.png", type: "image/png", content: PNG_BYTES, memo: memo.name },
    });
    expect(attachment.name).toMatch(/^attachments\//);
    expect(attachment.memo).toBe(memo.name);
    expect(Number(attachment.size)).toBe(PNG_BYTES.length);

    const path = `/file/${attachment.name}/pic.png`;
    const ownerResponse = await fetchFile(path, ALICE);
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await ownerResponse.arrayBuffer())).toEqual(PNG_BYTES);

    // PRIVATE memo: other users and anonymous are rejected.
    expect((await fetchFile(path, BOB)).status).toBe(403);
    expect((await fetchFile(path, "")).status).toBe(401);

    // Share token unlocks the attachment.
    const share = await memoClient.createMemoShare({ parent: memo.name, memoShare: {} });
    const token = share.name.split("/shares/")[1]!;
    expect((await fetchFile(`${path}?share_token=${token}`, "")).status).toBe(200);
  });

  it("serves attachments of public memos anonymously", async () => {
    await provision(ALICE);
    const alice = makeClient(AttachmentService, ALICE);
    const memoClient = makeClient(MemoService, ALICE);
    const memo = await memoClient.createMemo({ memo: { content: "public", visibility: Visibility.PUBLIC } });
    const attachment = await alice.createAttachment({
      attachment: { filename: "a.txt", type: "text/plain", content: new TextEncoder().encode("hello"), memo: memo.name },
    });
    const response = await fetchFile(`/file/${attachment.name}/a.txt`, "");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello");
  });

  it("lists, updates and deletes attachments with R2 cleanup", async () => {
    await provision(ALICE);
    const alice = makeClient(AttachmentService, ALICE);
    const a1 = await alice.createAttachment({
      attachment: { filename: "one.txt", type: "text/plain", content: new TextEncoder().encode("1") },
    });
    await alice.createAttachment({
      attachment: { filename: "two.png", type: "image/png", content: PNG_BYTES },
    });

    const all = await alice.listAttachments({});
    expect(all.attachments).toHaveLength(2);

    const filtered = await alice.listAttachments({ filter: 'mime_type == "image/png"' });
    expect(filtered.attachments).toHaveLength(1);
    expect(filtered.attachments[0]!.filename).toBe("two.png");

    const renamed = await alice.updateAttachment({
      attachment: { name: a1.name, filename: "renamed.txt" },
      updateMask: { paths: ["filename"] },
    });
    expect(renamed.filename).toBe("renamed.txt");

    await alice.deleteAttachment({ name: a1.name });
    await expect(alice.getAttachment({ name: a1.name })).rejects.toMatchObject({ code: Code.NotFound });
    const bucket = (env as unknown as Env).BUCKET;
    expect(await bucket.get("attachments/" + a1.name.split("/")[1] + "/one.txt")).toBeNull();
  });

  it("links attachments to memos via SetMemoAttachments", async () => {
    await provision(ALICE);
    const alice = makeClient(AttachmentService, ALICE);
    const memoClient = makeClient(MemoService, ALICE);
    const memo = await memoClient.createMemo({ memo: { content: "m", visibility: Visibility.PRIVATE } });
    const attachment = await alice.createAttachment({
      attachment: { filename: "f.txt", type: "text/plain", content: new TextEncoder().encode("x") },
    });
    await memoClient.setMemoAttachments({ name: memo.name, attachments: [{ name: attachment.name, filename: "f.txt" }] });
    const listed = await memoClient.listMemoAttachments({ name: memo.name });
    expect(listed.attachments.map((a) => a.name)).toEqual([attachment.name]);

    const full = await memoClient.getMemo({ name: memo.name });
    expect(full.attachments.map((a) => a.name)).toEqual([attachment.name]);

    await memoClient.setMemoAttachments({ name: memo.name, attachments: [] });
    const after = await memoClient.listMemoAttachments({ name: memo.name });
    expect(after.attachments).toHaveLength(0);
  });

  it("enforces the upload size limit", async () => {
    await provision(ALICE);
    const alice = makeClient(AttachmentService, ALICE);
    const huge = new Uint8Array(33 << 20);
    await expect(
      alice.createAttachment({ attachment: { filename: "big.bin", type: "application/octet-stream", content: huge } }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument });
  });
});
