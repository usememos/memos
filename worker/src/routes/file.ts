import type { Env } from "../env";
import type { RequestContext } from "../auth/context";
import { getAttachment } from "../store/attachments";
import { getMemo, listMemoShares } from "../store/memos";
import { getUser } from "../store/users";

const THUMBNAIL_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);

// Serves /file/attachments/{uid}/{filename} and /file/users/{username}/avatar
// from R2 / the user table, enforcing the same visibility rules as the Go
// fileserver. Returns undefined when the path is not a file route.
export async function handleFileRequest(
  request: Request,
  env: Env,
  auth: RequestContext,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  const avatarMatch = /^\/file\/users\/([^/]+)\/avatar$/.exec(url.pathname);
  if (avatarMatch) {
    return serveAvatar(env, decodeURIComponent(avatarMatch[1]!));
  }
  const attachmentMatch = /^\/file\/attachments\/([^/]+)\/(.+)$/.exec(url.pathname);
  if (attachmentMatch) {
    return serveAttachment(request, env, auth, decodeURIComponent(attachmentMatch[1]!), url);
  }
  return undefined;
}

async function serveAvatar(env: Env, username: string): Promise<Response> {
  const user = await getUser(env.DB, { username });
  if (!user || !user.avatar_url.startsWith("data:")) {
    return new Response("Not Found", { status: 404 });
  }
  const match = /^data:([^;]+);base64,(.+)$/.exec(user.avatar_url);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1]!,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function serveAttachment(
  request: Request,
  env: Env,
  auth: RequestContext,
  uid: string,
  url: URL,
): Promise<Response> {
  const attachment = await getAttachment(env.DB, { uid });
  if (!attachment) {
    return new Response("Not Found", { status: 404 });
  }

  const allowed = await checkAccess(env, auth, attachment.memo_id, attachment.creator_id, url.searchParams.get("share_token"));
  if (!allowed) {
    return new Response(auth.user ? "Forbidden" : "Unauthorized", { status: auth.user ? 403 : 401 });
  }

  // Thumbnails via Cloudflare Image Transformations; falls back to the
  // original image when transformations are unavailable (e.g. wrangler dev).
  if (url.searchParams.get("thumbnail") === "true" && THUMBNAIL_TYPES.has(attachment.type)) {
    const original = new URL(url);
    original.searchParams.delete("thumbnail");
    try {
      const transformed = await fetch(original.toString(), {
        headers: request.headers,
        cf: { image: { width: 600, height: 600, fit: "scale-down" } },
      } as RequestInit);
      if (transformed.ok) {
        return transformed;
      }
    } catch {
      // fall through to the original object
    }
  }

  const rangeHeader = request.headers.get("Range");
  const object = await env.BUCKET.get(attachment.r2_key, {
    range: rangeHeader ? request.headers : undefined,
    onlyIf: request.headers,
  });
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", attachment.type || "application/octet-stream");
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`);
  if (!("body" in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }
  if (rangeHeader && object.range && "offset" in object.range) {
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - offset;
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}

async function checkAccess(
  env: Env,
  auth: RequestContext,
  memoId: number | null,
  creatorId: number,
  shareToken: string | null,
): Promise<boolean> {
  if (auth.user && (auth.user.id === creatorId || auth.user.role === "ADMIN")) {
    return true;
  }
  // Unlinked attachments are only visible to their creator (handled above).
  if (memoId === null) {
    return false;
  }
  const memo = await getMemo(env.DB, { id: memoId });
  if (!memo) {
    return false;
  }
  if (memo.visibility === "PUBLIC") {
    return true;
  }
  if (memo.visibility === "PROTECTED" && auth.user) {
    return true;
  }
  // Share tokens grant access to the memo's attachments regardless of visibility.
  if (shareToken) {
    const shares = await listMemoShares(env.DB, { memoId, uid: shareToken });
    const share = shares[0];
    if (share && (share.expires_ts === null || share.expires_ts >= Math.floor(Date.now() / 1000))) {
      return true;
    }
  }
  return false;
}
