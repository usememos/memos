# Fileserver Package

The `fileserver` package serves binary content (attachments, avatars) over plain HTTP instead of gRPC, so that HTTP range requests work — required for Safari video/audio playback ([RFC 9110 §14](https://www.rfc-editor.org/rfc/rfc9110#section-14)). Metadata stays on the gRPC API; only bytes are served here.

## Endpoints

```text
GET /file/attachments/:uid[/:filename]   # attachment binary
    ?thumbnail=true                      # JPEG thumbnail for supported image types
    ?motion=true                         # embedded motion-photo video clip
    ?share_token={uid}                   # access via a memo share link
GET /file/users/:identifier/avatar       # user avatar (by username)
```

## Authentication

Handled by `server/auth` (see [authenticator.go](../../auth/authenticator.go) and [token.go](../../auth/token.go) for the constants and token formats). Priority: `Authorization: Bearer` header (access token or personal access token) first, then the refresh token cookie. See `getCurrentUser` in [fileserver.go](fileserver.go).

## Authorization

Attachment access follows memo visibility, evaluated by `server/access.CheckMemoRead`:

- Public memo: no auth required (when the instance allows anonymous access)
- Protected memo: any authenticated user
- Private memo: creator only
- Valid `share_token`: grants access to that memo's attachments
- Unlinked attachment (no memo): creator or admin only

Avatars are public on instances that allow anonymous access; private instances require authentication.

## Serving behavior

- **Video/audio** are streamed with range-request support (`http.ServeFile` / `http.ServeContent` for local and database storage); S3-backed media is proxied with ranged `GetObject` requests.
- **Thumbnails** are generated at max 600px, cached in `{data_dir}/.thumbnail_cache/`, with a semaphore capping concurrent generation. Images with HDR/wide-gamut metadata are served as originals, since re-encoding would strip it.
- **Motion photos** have their embedded video extracted and cached in `{data_dir}/.motion_cache/`.
- **XSS prevention**: script-capable MIME types are rewritten to `application/octet-stream`, non-media files get `Content-Disposition: attachment`, and all responses carry `X-Content-Type-Options: nosniff` plus a restrictive `Content-Security-Policy`.
- **Caching**: public attachments get `public, no-cache`; private ones `private, no-store`; avatars and thumbnails `public, max-age=3600`.

## Testing

Unit tests live in [fileserver_test.go](fileserver_test.go), covering permission checks, streaming, thumbnails, and metadata detection. Manual checks:

```bash
curl "http://localhost:8081/file/attachments/{uid}/file.jpg"
curl -H "Range: bytes=0-999" "http://localhost:8081/file/attachments/{uid}/video.mp4"
```
