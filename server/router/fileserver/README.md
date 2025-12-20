# Fileserver Package

## Overview

The `fileserver` package handles all binary file serving for Memos using native HTTP handlers. It was created to replace gRPC-based binary serving, which had limitations with HTTP range requests (required for Safari video/audio playback).

## Responsibilities

- Serve attachment binary files (images, videos, audio, documents)
- Serve user avatar images
- Handle HTTP range requests for video/audio streaming
- Authenticate requests using JWT tokens or Personal Access Tokens
- Check permissions for private content
- Generate and serve image thumbnails
- Prevent XSS attacks on uploaded content
- Support S3 external storage

## Architecture

### Design Principles

1. **Separation of Concerns**: Binary files via HTTP, metadata via gRPC
2. **DRY**: Imports auth constants from `api/v1` package (single source of truth)
3. **Security First**: Authentication, authorization, and XSS prevention
4. **Performance**: Native HTTP streaming with proper caching headers

### Package Structure

```
fileserver/
├── fileserver.go           # Main service and HTTP handlers
├── README.md              # This file
└── fileserver_test.go     # Tests (to be added)
```

## API Endpoints

### 1. Attachment Binary
```
GET /file/attachments/:uid/:filename[?thumbnail=true]
```

**Parameters:**
- `uid` - Attachment unique identifier
- `filename` - Original filename
- `thumbnail` (optional) - Return thumbnail for images

**Authentication:** Required for non-public memos

**Response:**
- `200 OK` - File content with proper Content-Type
- `206 Partial Content` - For range requests (video/audio)
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - User not authorized
- `404 Not Found` - Attachment not found

**Headers:**
- `Content-Type` - MIME type of the file
- `Cache-Control: public, max-age=3600`
- `Accept-Ranges: bytes` - For video/audio
- `Content-Range` - For partial responses (206)

### 2. User Avatar
```
GET /file/users/:identifier/avatar
```

**Parameters:**
- `identifier` - User ID (e.g., `1`) or username (e.g., `steven`)

**Authentication:** Not required (avatars are public)

**Response:**
- `200 OK` - Avatar image (PNG/JPEG)
- `404 Not Found` - User not found or no avatar set

**Headers:**
- `Content-Type` - image/png or image/jpeg
- `Cache-Control: public, max-age=3600`

## Authentication

### Supported Methods

The fileserver supports the following authentication methods:

1. **JWT Access Token** (`Authorization: Bearer {token}`)
   - Short-lived tokens (15 minutes) for API access
   - Stateless validation using JWT signature
   - Extracts user ID from token claims

2. **Personal Access Token (PAT)** (`Authorization: Bearer {pat}`)
   - Long-lived tokens for programmatic access
   - Validates against database for revocation
   - Prefixed with specific identifier

### Authentication Flow

```
Request → getCurrentUser()
    ├─→ Try Session Cookie
    │   ├─→ Parse cookie value
    │   ├─→ Get user from DB
    │   ├─→ Validate session
    │   └─→ Return user (if valid)
    │
    └─→ Try JWT Token
        ├─→ Parse Authorization header
        ├─→ Verify JWT signature
        ├─→ Get user from DB
        ├─→ Validate token in access tokens list
        └─→ Return user (if valid)
```

### Permission Model

**Attachments:**
- Unlinked: Public (no auth required)
- Public memo: Public (no auth required)
- Protected memo: Requires authentication
- Private memo: Creator only

**Avatars:**
- Always public (no auth required)

## Key Functions

### HTTP Handlers

#### `serveAttachmentFile(c echo.Context) error`
Main handler for attachment binary serving.

**Flow:**
1. Extract UID from URL parameter
2. Fetch attachment from database
3. Check permissions (memo visibility)
4. Get binary blob (local file, S3, or database)
5. Handle thumbnail request (if applicable)
6. Set security headers (XSS prevention)
7. Serve with range request support (video/audio)

#### `serveUserAvatar(c echo.Context) error`
Main handler for user avatar serving.

**Flow:**
1. Extract identifier (ID or username) from URL
2. Lookup user in database
3. Check if avatar exists
4. Decode base64 data URI
5. Serve with proper content type and caching

### Authentication

#### `getCurrentUser(ctx, c) (*store.User, error)`
Authenticates request using session cookie or JWT token.

#### `authenticateBySession(ctx, cookie) (*store.User, error)`
Validates session cookie and returns authenticated user.

#### `authenticateByJWT(ctx, token) (*store.User, error)`
Validates JWT access token and returns authenticated user.

### Permission Checks

#### `checkAttachmentPermission(ctx, c, attachment) error`
Validates user has permission to access attachment based on memo visibility.

### File Operations

#### `getAttachmentBlob(attachment) ([]byte, error)`
Retrieves binary content from local storage, S3, or database.

#### `getOrGenerateThumbnail(ctx, attachment) ([]byte, error)`
Returns cached thumbnail or generates new one (with semaphore limiting).

### Utilities

#### `getUserByIdentifier(ctx, identifier) (*store.User, error)`
Finds user by ID (int) or username (string).

#### `extractImageInfo(dataURI) (type, base64, error)`
Parses data URI to extract MIME type and base64 data.

## Dependencies

### External Packages
- `github.com/labstack/echo/v4` - HTTP router and middleware
- `github.com/golang-jwt/jwt/v5` - JWT parsing and validation
- `github.com/disintegration/imaging` - Image thumbnail generation
- `golang.org/x/sync/semaphore` - Concurrency control for thumbnails

### Internal Packages
- `server/auth` - Authentication utilities
- `store` - Database operations
- `internal/profile` - Server configuration
- `plugin/storage/s3` - S3 storage client

## Configuration

### Constants

Auth-related constants are imported from `server/auth`:
- `auth.RefreshTokenCookieName` - "memos_refresh"
- `auth.PersonalAccessTokenPrefix` - PAT identifier prefix

Package-specific constants:
- `ThumbnailCacheFolder` - ".thumbnail_cache"
- `thumbnailMaxSize` - 600px
- `SupportedThumbnailMimeTypes` - ["image/png", "image/jpeg"]

## Error Handling

All handlers return Echo HTTP errors with appropriate status codes:

```go
// Bad request
echo.NewHTTPError(http.StatusBadRequest, "message")

// Unauthorized (no auth)
echo.NewHTTPError(http.StatusUnauthorized, "message")

// Forbidden (auth but no permission)
echo.NewHTTPError(http.StatusForbidden, "message")

// Not found
echo.NewHTTPError(http.StatusNotFound, "message")

// Internal error
echo.NewHTTPError(http.StatusInternalServerError, "message").SetInternal(err)
```

## Security Considerations

### 1. XSS Prevention
SVG and HTML files are served as `application/octet-stream` to prevent script execution:

```go
if contentType == "image/svg+xml" ||
   contentType == "text/html" ||
   contentType == "application/xhtml+xml" {
    contentType = "application/octet-stream"
}
```

### 2. Authentication
Private content requires valid JWT access token or Personal Access Token.

### 3. Authorization
Memo visibility rules enforced before serving attachments.

### 4. Input Validation
- Attachment UID validated from database
- User identifier validated (ID or username)
- Range requests validated before processing

## Performance Optimizations

### 1. Thumbnail Caching
Thumbnails cached on disk to avoid regeneration:
- Cache location: `{data_dir}/.thumbnail_cache/`
- Filename: `{attachment_id}{extension}`
- Semaphore limits concurrent generation (max 3)

### 2. HTTP Range Requests
Video/audio files use `http.ServeContent()` for efficient streaming:
- Automatic range parsing
- Efficient memory usage (streaming, not loading full file)
- Safari-compatible partial content responses

### 3. Caching Headers
All responses include cache headers:
```
Cache-Control: public, max-age=3600
```

### 4. S3 External Links
S3 files served via presigned URLs (no server download).

## Testing

### Unit Tests (To Add)
See SAFARI_FIX.md for recommended test coverage.

### Manual Testing
```bash
# Test attachment
curl "http://localhost:8081/file/attachments/{uid}/file.jpg"

# Test avatar by ID
curl "http://localhost:8081/file/users/1/avatar"

# Test avatar by username
curl "http://localhost:8081/file/users/steven/avatar"

# Test range request
curl -H "Range: bytes=0-999" "http://localhost:8081/file/attachments/{uid}/video.mp4"
```

## Future Improvements

See SAFARI_FIX.md section "Future Improvements" for planned enhancements.

## Related Documentation

- [SAFARI_FIX.md](../../../SAFARI_FIX.md) - Full migration guide
- [server/router/api/v1/auth.go](../api/v1/auth.go) - Auth constants source of truth
- [RFC 7233](https://tools.ietf.org/html/rfc7233) - HTTP Range Requests spec
