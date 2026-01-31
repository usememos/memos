package fileserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/sync/semaphore"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/storage/s3"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// Constants for file serving configuration.
const (
	// ThumbnailCacheFolder is the folder name where thumbnail images are stored.
	ThumbnailCacheFolder = ".thumbnail_cache"

	// thumbnailMaxSize is the maximum dimension (width or height) for thumbnails.
	thumbnailMaxSize = 600

	// maxConcurrentThumbnails limits concurrent thumbnail generation to prevent memory exhaustion.
	maxConcurrentThumbnails = 3

	// cacheMaxAge is the max-age value for Cache-Control headers (1 hour).
	cacheMaxAge = "public, max-age=3600"
)

// xssUnsafeTypes contains MIME types that could execute scripts if served directly.
// These are served as application/octet-stream to prevent XSS attacks.
var xssUnsafeTypes = map[string]bool{
	"text/html":                true,
	"text/javascript":          true,
	"application/javascript":   true,
	"application/x-javascript": true,
	"text/xml":                 true,
	"application/xml":          true,
	"application/xhtml+xml":    true,
	"image/svg+xml":            true,
}

// thumbnailSupportedTypes contains image MIME types that support thumbnail generation.
var thumbnailSupportedTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/heic": true,
	"image/heif": true,
	"image/webp": true,
}

// avatarAllowedTypes contains MIME types allowed for user avatars.
var avatarAllowedTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/jpg":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/heic": true,
	"image/heif": true,
}

// SupportedThumbnailMimeTypes is the exported list of thumbnail-supported MIME types.
var SupportedThumbnailMimeTypes = []string{
	"image/png",
	"image/jpeg",
	"image/heic",
	"image/heif",
	"image/webp",
}

// dataURIRegex parses data URI format: data:image/png;base64,iVBORw0KGgo...
var dataURIRegex = regexp.MustCompile(`^data:(?P<type>[^;]+);base64,(?P<base64>.+)`)

// FileServerService handles HTTP file serving with proper range request support.
type FileServerService struct {
	Profile       *profile.Profile
	Store         *store.Store
	authenticator *auth.Authenticator

	// thumbnailSemaphore limits concurrent thumbnail generation.
	thumbnailSemaphore *semaphore.Weighted
}

// NewFileServerService creates a new file server service.
func NewFileServerService(profile *profile.Profile, store *store.Store, secret string) *FileServerService {
	return &FileServerService{
		Profile:            profile,
		Store:              store,
		authenticator:      auth.NewAuthenticator(store, secret),
		thumbnailSemaphore: semaphore.NewWeighted(maxConcurrentThumbnails),
	}
}

// RegisterRoutes registers HTTP file serving routes.
func (s *FileServerService) RegisterRoutes(echoServer *echo.Echo) {
	fileGroup := echoServer.Group("/file")
	fileGroup.GET("/attachments/:uid/:filename", s.serveAttachmentFile)
	fileGroup.GET("/users/:identifier/avatar", s.serveUserAvatar)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// serveAttachmentFile serves attachment binary content using native HTTP.
func (s *FileServerService) serveAttachmentFile(c echo.Context) error {
	ctx := c.Request().Context()
	uid := c.Param("uid")
	wantThumbnail := c.QueryParam("thumbnail") == "true"

	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{
		UID:     &uid,
		GetBlob: true,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment").SetInternal(err)
	}
	if attachment == nil {
		return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
	}

	if err := s.checkAttachmentPermission(ctx, c, attachment); err != nil {
		return err
	}

	contentType := s.sanitizeContentType(attachment.Type)

	// Stream video/audio to avoid loading entire file into memory.
	if isMediaType(attachment.Type) {
		return s.serveMediaStream(c, attachment, contentType)
	}

	return s.serveStaticFile(c, attachment, contentType, wantThumbnail)
}

// serveUserAvatar serves user avatar images.
func (s *FileServerService) serveUserAvatar(c echo.Context) error {
	ctx := c.Request().Context()
	identifier := c.Param("identifier")

	user, err := s.getUserByIdentifier(ctx, identifier)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user").SetInternal(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	if user.AvatarURL == "" {
		return echo.NewHTTPError(http.StatusNotFound, "avatar not found")
	}

	imageType, imageData, err := s.parseDataURI(user.AvatarURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to parse avatar data").SetInternal(err)
	}

	if !avatarAllowedTypes[imageType] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid avatar image type")
	}

	setSecurityHeaders(c)
	c.Response().Header().Set(echo.HeaderContentType, imageType)
	c.Response().Header().Set(echo.HeaderCacheControl, cacheMaxAge)

	return c.Blob(http.StatusOK, imageType, imageData)
}

// =============================================================================
// File Serving Methods
// =============================================================================

// serveMediaStream serves video/audio files using streaming to avoid memory exhaustion.
func (s *FileServerService) serveMediaStream(c echo.Context, attachment *store.Attachment, contentType string) error {
	setSecurityHeaders(c)
	setMediaHeaders(c, contentType, attachment.Type)

	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		filePath, err := s.resolveLocalPath(attachment.Reference)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve file path").SetInternal(err)
		}
		http.ServeFile(c.Response(), c.Request(), filePath)
		return nil

	case storepb.AttachmentStorageType_S3:
		presignURL, err := s.getS3PresignedURL(c.Request().Context(), attachment)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate presigned URL").SetInternal(err)
		}
		return c.Redirect(http.StatusTemporaryRedirect, presignURL)

	default:
		// Database storage fallback.
		modTime := time.Unix(attachment.UpdatedTs, 0)
		http.ServeContent(c.Response(), c.Request(), attachment.Filename, modTime, bytes.NewReader(attachment.Blob))
		return nil
	}
}

// serveStaticFile serves non-streaming files (images, documents, etc.).
func (s *FileServerService) serveStaticFile(c echo.Context, attachment *store.Attachment, contentType string, wantThumbnail bool) error {
	blob, err := s.getAttachmentBlob(attachment)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment blob").SetInternal(err)
	}

	// Generate thumbnail for supported image types.
	if wantThumbnail && thumbnailSupportedTypes[attachment.Type] {
		if thumbnailBlob, err := s.getOrGenerateThumbnail(c.Request().Context(), attachment); err != nil {
			c.Logger().Warnf("failed to get thumbnail: %v", err)
		} else {
			blob = thumbnailBlob
		}
	}

	setSecurityHeaders(c)
	setMediaHeaders(c, contentType, attachment.Type)

	// Force download for non-media files to prevent XSS execution.
	if !strings.HasPrefix(contentType, "image/") && contentType != "application/pdf" {
		c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=%q", attachment.Filename))
	}

	return c.Blob(http.StatusOK, contentType, blob)
}

// =============================================================================
// Storage Operations
// =============================================================================

// getAttachmentBlob retrieves the binary content of an attachment from storage.
func (s *FileServerService) getAttachmentBlob(attachment *store.Attachment) ([]byte, error) {
	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		return s.readLocalFile(attachment.Reference)

	case storepb.AttachmentStorageType_S3:
		return s.downloadFromS3(attachment)

	default:
		return attachment.Blob, nil
	}
}

// getAttachmentReader returns a reader for streaming attachment content.
func (s *FileServerService) getAttachmentReader(attachment *store.Attachment) (io.ReadCloser, error) {
	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		filePath, err := s.resolveLocalPath(attachment.Reference)
		if err != nil {
			return nil, err
		}
		file, err := os.Open(filePath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open file")
		}
		return file, nil

	case storepb.AttachmentStorageType_S3:
		s3Client, s3Object, err := s.createS3Client(attachment)
		if err != nil {
			return nil, err
		}
		reader, err := s3Client.GetObjectStream(context.Background(), s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to stream from S3")
		}
		return reader, nil

	default:
		return io.NopCloser(bytes.NewReader(attachment.Blob)), nil
	}
}

// resolveLocalPath converts a storage reference to an absolute file path.
func (s *FileServerService) resolveLocalPath(reference string) (string, error) {
	filePath := filepath.FromSlash(reference)
	if !filepath.IsAbs(filePath) {
		filePath = filepath.Join(s.Profile.Data, filePath)
	}
	return filePath, nil
}

// readLocalFile reads the entire contents of a local file.
func (s *FileServerService) readLocalFile(reference string) ([]byte, error) {
	filePath, err := s.resolveLocalPath(reference)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, errors.Wrap(err, "file not found")
		}
		return nil, errors.Wrap(err, "failed to open file")
	}
	defer file.Close()

	blob, err := io.ReadAll(file)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read file")
	}
	return blob, nil
}

// createS3Client creates an S3 client from attachment payload.
func (*FileServerService) createS3Client(attachment *store.Attachment) (*s3.Client, *storepb.AttachmentPayload_S3Object, error) {
	if attachment.Payload == nil {
		return nil, nil, errors.New("attachment payload is missing")
	}
	s3Object := attachment.Payload.GetS3Object()
	if s3Object == nil {
		return nil, nil, errors.New("S3 object payload is missing")
	}
	if s3Object.S3Config == nil {
		return nil, nil, errors.New("S3 config is missing")
	}
	if s3Object.Key == "" {
		return nil, nil, errors.New("S3 object key is missing")
	}

	client, err := s3.NewClient(context.Background(), s3Object.S3Config)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to create S3 client")
	}
	return client, s3Object, nil
}

// downloadFromS3 downloads the entire object from S3.
func (s *FileServerService) downloadFromS3(attachment *store.Attachment) ([]byte, error) {
	client, s3Object, err := s.createS3Client(attachment)
	if err != nil {
		return nil, err
	}

	blob, err := client.GetObject(context.Background(), s3Object.Key)
	if err != nil {
		return nil, errors.Wrap(err, "failed to download from S3")
	}
	return blob, nil
}

// getS3PresignedURL generates a presigned URL for direct S3 access.
func (s *FileServerService) getS3PresignedURL(ctx context.Context, attachment *store.Attachment) (string, error) {
	client, s3Object, err := s.createS3Client(attachment)
	if err != nil {
		return "", err
	}

	url, err := client.PresignGetObject(ctx, s3Object.Key)
	if err != nil {
		return "", errors.Wrap(err, "failed to presign URL")
	}
	return url, nil
}

// =============================================================================
// Thumbnail Generation
// =============================================================================

// getOrGenerateThumbnail returns the thumbnail image of the attachment.
// Uses semaphore to limit concurrent thumbnail generation and prevent memory exhaustion.
func (s *FileServerService) getOrGenerateThumbnail(ctx context.Context, attachment *store.Attachment) ([]byte, error) {
	thumbnailPath, err := s.getThumbnailPath(attachment)
	if err != nil {
		return nil, err
	}

	// Fast path: return cached thumbnail if exists.
	if blob, err := s.readCachedThumbnail(thumbnailPath); err == nil {
		return blob, nil
	}

	// Acquire semaphore to limit concurrent generation.
	if err := s.thumbnailSemaphore.Acquire(ctx, 1); err != nil {
		return nil, errors.Wrap(err, "failed to acquire semaphore")
	}
	defer s.thumbnailSemaphore.Release(1)

	// Double-check after acquiring semaphore (another goroutine may have generated it).
	if blob, err := s.readCachedThumbnail(thumbnailPath); err == nil {
		return blob, nil
	}

	return s.generateThumbnail(attachment, thumbnailPath)
}

// getThumbnailPath returns the file path for a cached thumbnail.
func (s *FileServerService) getThumbnailPath(attachment *store.Attachment) (string, error) {
	cacheFolder := filepath.Join(s.Profile.Data, ThumbnailCacheFolder)
	if err := os.MkdirAll(cacheFolder, os.ModePerm); err != nil {
		return "", errors.Wrap(err, "failed to create thumbnail cache folder")
	}
	filename := fmt.Sprintf("%d%s", attachment.ID, filepath.Ext(attachment.Filename))
	return filepath.Join(cacheFolder, filename), nil
}

// readCachedThumbnail reads a thumbnail from the cache directory.
func (*FileServerService) readCachedThumbnail(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return io.ReadAll(file)
}

// generateThumbnail creates a new thumbnail and saves it to disk.
func (s *FileServerService) generateThumbnail(attachment *store.Attachment, thumbnailPath string) ([]byte, error) {
	reader, err := s.getAttachmentReader(attachment)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get attachment reader")
	}
	defer reader.Close()

	img, err := imaging.Decode(reader, imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode image")
	}

	width, height := img.Bounds().Dx(), img.Bounds().Dy()
	thumbnailWidth, thumbnailHeight := calculateThumbnailDimensions(width, height)

	thumbnailImage := imaging.Resize(img, thumbnailWidth, thumbnailHeight, imaging.Lanczos)

	if err := imaging.Save(thumbnailImage, thumbnailPath); err != nil {
		return nil, errors.Wrap(err, "failed to save thumbnail")
	}

	return s.readCachedThumbnail(thumbnailPath)
}

// calculateThumbnailDimensions calculates the target dimensions for a thumbnail.
// The largest dimension is constrained to thumbnailMaxSize while maintaining aspect ratio.
// Small images are not enlarged.
func calculateThumbnailDimensions(width, height int) (int, int) {
	if max(width, height) <= thumbnailMaxSize {
		return width, height
	}
	if width >= height {
		return thumbnailMaxSize, 0 // Landscape: constrain width.
	}
	return 0, thumbnailMaxSize // Portrait: constrain height.
}

// =============================================================================
// Authentication & Authorization
// =============================================================================

// checkAttachmentPermission verifies the user has permission to access the attachment.
func (s *FileServerService) checkAttachmentPermission(ctx context.Context, c echo.Context, attachment *store.Attachment) error {
	// For unlinked attachments, only the creator can access.
	if attachment.MemoID == nil {
		user, err := s.getCurrentUser(ctx, c)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
		}
		if user.ID != attachment.CreatorID && user.Role != store.RoleAdmin {
			return echo.NewHTTPError(http.StatusForbidden, "forbidden access")
		}
		return nil
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to find memo").SetInternal(err)
	}
	if memo == nil {
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}

	if memo.Visibility == store.Public {
		return nil
	}

	user, err := s.getCurrentUser(ctx, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").SetInternal(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
	}

	if memo.Visibility == store.Private && user.ID != memo.CreatorID && user.Role != store.RoleAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "forbidden access")
	}

	return nil
}

// getCurrentUser retrieves the current authenticated user from the request.
// Authentication priority: Bearer token (Access Token V2 or PAT) > Refresh token cookie.
func (s *FileServerService) getCurrentUser(ctx context.Context, c echo.Context) (*store.User, error) {
	// Try Bearer token authentication.
	if authHeader := c.Request().Header.Get(echo.HeaderAuthorization); authHeader != "" {
		if user, err := s.authenticateByBearerToken(ctx, authHeader); err == nil && user != nil {
			return user, nil
		}
	}

	// Fallback: Try refresh token cookie.
	if cookieHeader := c.Request().Header.Get("Cookie"); cookieHeader != "" {
		if user, err := s.authenticateByRefreshToken(ctx, cookieHeader); err == nil && user != nil {
			return user, nil
		}
	}

	return nil, nil
}

// authenticateByBearerToken authenticates using Authorization header.
func (s *FileServerService) authenticateByBearerToken(ctx context.Context, authHeader string) (*store.User, error) {
	token := auth.ExtractBearerToken(authHeader)
	if token == "" {
		return nil, nil
	}

	// Try Access Token V2 (stateless JWT).
	if !strings.HasPrefix(token, auth.PersonalAccessTokenPrefix) {
		claims, err := s.authenticator.AuthenticateByAccessTokenV2(token)
		if err == nil && claims != nil {
			return s.Store.GetUser(ctx, &store.FindUser{ID: &claims.UserID})
		}
	}

	// Try Personal Access Token (stateful).
	if strings.HasPrefix(token, auth.PersonalAccessTokenPrefix) {
		user, _, err := s.authenticator.AuthenticateByPAT(ctx, token)
		if err == nil {
			return user, nil
		}
	}

	return nil, nil
}

// authenticateByRefreshToken authenticates using refresh token cookie.
func (s *FileServerService) authenticateByRefreshToken(ctx context.Context, cookieHeader string) (*store.User, error) {
	refreshToken := auth.ExtractRefreshTokenFromCookie(cookieHeader)
	if refreshToken == "" {
		return nil, nil
	}

	user, _, err := s.authenticator.AuthenticateByRefreshToken(ctx, refreshToken)
	return user, err
}

// getUserByIdentifier finds a user by either ID or username.
func (s *FileServerService) getUserByIdentifier(ctx context.Context, identifier string) (*store.User, error) {
	if userID, err := util.ConvertStringToInt32(identifier); err == nil {
		return s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	}
	return s.Store.GetUser(ctx, &store.FindUser{Username: &identifier})
}

// =============================================================================
// Helper Functions
// =============================================================================

// sanitizeContentType converts potentially dangerous MIME types to safe alternatives.
func (*FileServerService) sanitizeContentType(mimeType string) string {
	contentType := mimeType
	if strings.HasPrefix(contentType, "text/") {
		contentType += "; charset=utf-8"
	}
	// Normalize for case-insensitive lookup.
	if xssUnsafeTypes[strings.ToLower(mimeType)] {
		return "application/octet-stream"
	}
	return contentType
}

// parseDataURI extracts MIME type and decoded data from a data URI.
func (*FileServerService) parseDataURI(dataURI string) (string, []byte, error) {
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", nil, errors.New("invalid data URI format")
	}

	imageType := matches[1]
	imageData, err := base64.StdEncoding.DecodeString(matches[2])
	if err != nil {
		return "", nil, errors.Wrap(err, "failed to decode base64 data")
	}

	return imageType, imageData, nil
}

// isMediaType checks if the MIME type is video or audio.
func isMediaType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "video/") || strings.HasPrefix(mimeType, "audio/")
}

// setSecurityHeaders sets common security headers for all responses.
func setSecurityHeaders(c echo.Context) {
	h := c.Response().Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';")
}

// setMediaHeaders sets headers for media file responses.
func setMediaHeaders(c echo.Context, contentType, originalType string) {
	h := c.Response().Header()
	h.Set(echo.HeaderContentType, contentType)
	h.Set(echo.HeaderCacheControl, cacheMaxAge)

	// Support HDR/wide color gamut for images and videos.
	if strings.HasPrefix(originalType, "image/") || strings.HasPrefix(originalType, "video/") {
		h.Set("Color-Gamut", "srgb, p3, rec2020")
	}
}
