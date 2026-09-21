---
title: "File serving contract"
status: draft
tags:
  - "fileserver"
---

## Purpose & Scope
This spec defines the HTTP file-serving contract for attachment and avatar bytes: endpoints, authentication, authorization, streaming, derived images, and response headers. It is normative for @server/fileserver/fileserver.go. The web app, share-link viewers, browsers playing media (Safari needs HTTP range requests, [RFC 9110 §14](https://www.rfc-editor.org/rfc/rfc9110#section-14)), and any client fetching attachment bytes depend on it.
Out of scope: attachment metadata, which stays on the gRPC API; upload; storage backends beyond how bytes are read; file and avatar rate limits.

## Surface
- `GET /file/attachments/:uid` and `GET /file/attachments/:uid/:filename` — attachment bytes; query `thumbnail=true` (JPEG thumbnail for supported image types), `motion=true` (embedded motion-photo video clip), `share_token={uid}` (memo share link).
- `GET /file/users/:identifier/avatar` — user avatar, where `identifier` is the username.
- Authentication through `getCurrentUser` and `Authenticator.AuthenticateToUser` (@server/auth/authenticator.go); token formats and constants in @server/auth/token.go.
- Authorization through `access.CheckMemoReadContext` (@core/access/memo.go).
- Cache folders `{data_dir}/.thumbnail_cache/` and `{data_dir}/.motion_cache/`.

## Normative Behavior
Authentication and authorization
1. WHEN a file request carries credentials, the server MUST try the `Authorization: Bearer` header (access token or personal access token) first.
2. IF no valid bearer token resolves, THEN the server MUST fall back to the refresh token cookie.
3. WHEN an attachment belongs to a memo, the server MUST authorize it by that memo's read access through `CheckMemoReadContext`.
4. WHILE the memo is public, the server MUST serve the attachment without authentication when the instance allows anonymous access.
5. WHILE the memo is protected, the server MUST serve the attachment to any authenticated user.
6. WHILE the memo is private, the server MUST serve the attachment only to its creator.
7. WHEN a request carries a valid, unexpired `share_token`, the server MUST grant access to that memo's attachments.
8. WHEN an attachment has no memo, the server MUST serve it only to its creator.
9. WHILE the instance allows anonymous access, the server MUST serve avatars without authentication.
10. WHILE the instance disallows anonymous access, the server MUST require authentication for avatars.

Serving
11. The server MUST stream video and audio with HTTP range-request support: `http.ServeFile` or `http.ServeContent` for local and database storage.
12. WHEN media is S3-backed, the server MUST proxy it with ranged `GetObject` requests.
13. WHEN `thumbnail=true` targets a supported image type, the server MUST return a JPEG thumbnail no larger than 600 px in either dimension.
14. The server MUST cache generated thumbnails in `{data_dir}/.thumbnail_cache/` and cap concurrent generation with a semaphore.
15. IF the original image carries HDR or wide-gamut metadata, THEN the server MUST serve the original instead of a re-encoded thumbnail.
16. WHEN `motion=true` targets a motion photo, the server MUST extract the embedded video and cache it in `{data_dir}/.motion_cache/`.

Response headers
17. The server MUST rewrite script-capable MIME types to `application/octet-stream`.
18. WHEN the file is not media, the server MUST set `Content-Disposition: attachment`.
19. The server MUST send `X-Content-Type-Options: nosniff` on every response.
20. The server MUST send a restrictive `Content-Security-Policy` on every response.
21. WHEN the attachment is publicly readable, the server MUST send `Cache-Control: public, no-cache`.
22. WHEN the attachment is not publicly readable, the server MUST send `Cache-Control: private, no-store`.
23. WHILE the instance allows anonymous access, the server MUST send `Cache-Control: public, max-age=3600` for avatars.

## Constraints & Invariants
- Only bytes are served here; metadata stays on the gRPC API.
- Thumbnail size limit: 600 px maximum dimension (`thumbnailMaxSize`).
- Constraint: HDR or wide-gamut images serve as originals because re-encoding would strip that metadata.
- Invariant: no script-capable content type reaches the browser from this server, and every response carries `nosniff`.

## Failure Behavior
1. IF the attachment does not exist, THEN the server MUST return HTTP 404.
2. IF an unauthenticated caller requests a non-public attachment or a private-instance avatar, THEN the server MUST return HTTP 401.
3. IF an authenticated caller lacks read access, THEN the server MUST return HTTP 403.
4. IF the share token is expired or unknown, THEN the server MUST evaluate access as if no token were given.
5. IF thumbnail generation fails, THEN the server MUST serve the original image.

## Conformance
An implementation is conformant when it satisfies behaviors 1–23, holds the invariants, and follows the failure rules. Unit tests in @server/fileserver/fileserver_test.go cover permission checks, streaming, thumbnails, and metadata detection. A manual check fetches `http://localhost:8081/file/attachments/{uid}/file.jpg`, then repeats a video fetch with `Range: bytes=0-999`.
Given a video attachment on a protected memo,
When an authenticated user requests it with `Range: bytes=0-999`,
Then the server returns the requested byte range with `private, no-store` caching.
