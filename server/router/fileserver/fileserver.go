package fileserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/labstack/echo/v5"
	"github.com/pkg/errors"
	"golang.org/x/sync/semaphore"

	"github.com/usememos/memos/internal/motionphoto"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/storage"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/access"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// Constants for file serving configuration.
const (
	// thumbnailCacheFolder is the folder name where thumbnail images are stored.
	thumbnailCacheFolder = ".thumbnail_cache"

	// motionCacheFolder is the folder name where extracted motion clips are stored.
	motionCacheFolder = ".motion_cache"

	// thumbnailMaxSize is the maximum dimension (width or height) for thumbnails.
	thumbnailMaxSize = 600

	// thumbnailMetadataProbeSize is the maximum number of original image bytes inspected
	// before thumbnail generation to detect metadata that the JPEG thumbnail pipeline cannot preserve.
	thumbnailMetadataProbeSize = 1 << 20

	// maxConcurrentThumbnails limits concurrent thumbnail generation to prevent memory exhaustion.
	maxConcurrentThumbnails = 3

	// cacheMaxAge is the max-age value for Cache-Control headers (1 hour).
	cacheMaxAge = "public, max-age=3600"

	publicAttachmentCacheControl  = "public, no-cache"
	privateAttachmentCacheControl = "private, no-store"
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
}

// thumbnailSupportedTypes contains image MIME types that support thumbnail generation.
var thumbnailSupportedTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/jpg":  true,
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

var errUseOriginalForThumbnail = errors.New("serve original image instead of metadata-stripping thumbnail")

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
	fileGroup.GET("/attachments/:uid", s.serveAttachmentFile)
	fileGroup.GET("/attachments/:uid/:filename", s.serveAttachmentFile)
	fileGroup.GET("/users/:identifier/avatar", s.serveUserAvatar)
}

// =============================================================================
// HTTP Handlers
// =============================================================================

// serveAttachmentFile serves attachment binary content using native HTTP.
func (s *FileServerService) serveAttachmentFile(c *echo.Context) error {
	ctx := c.Request().Context()
	c.Response().Header().Set(echo.HeaderCacheControl, privateAttachmentCacheControl)
	uid := c.Param("uid")
	wantThumbnail := c.QueryParam("thumbnail") == "true"
	wantMotion := c.QueryParam("motion") == "true"

	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{
		UID:     &uid,
		GetBlob: true,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment").Wrap(err)
	}
	if attachment == nil {
		return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
	}

	readClass, err := s.checkAttachmentPermission(ctx, c, attachment)
	if err != nil {
		return err
	}
	if readClass == access.MemoReadClassPublic {
		c.Response().Header().Set(echo.HeaderCacheControl, publicAttachmentCacheControl)
	}

	if wantMotion {
		return s.serveMotionClip(c, attachment)
	}

	contentType := sanitizeContentType(attachment.Type)

	// Stream video/audio to avoid loading entire file into memory.
	if isMediaType(attachment.Type) {
		return s.serveMediaStream(c, attachment, contentType)
	}

	return s.serveStaticFile(c, attachment, contentType, wantThumbnail)
}

// serveUserAvatar serves user avatar images.
func (s *FileServerService) serveUserAvatar(c *echo.Context) error {
	ctx := c.Request().Context()

	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get instance access policy").Wrap(err)
	}
	cacheControl := cacheMaxAge
	// On a private instance, avatars are not exposed to anonymous visitors; a
	// valid session, access token, or PAT is required.
	if !allowAnonymous {
		cacheControl = privateAttachmentCacheControl
		viewer, err := s.getCurrentUser(ctx, c)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").Wrap(err)
		}
		if viewer == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
		}
	}

	identifier := c.Param("identifier")

	user, err := s.Store.GetUser(ctx, &store.FindUser{Username: &identifier})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user").Wrap(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	if user.AvatarURL == "" {
		return echo.NewHTTPError(http.StatusNotFound, "avatar not found")
	}

	imageType, imageData, err := parseDataURI(user.AvatarURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to parse avatar data").Wrap(err)
	}

	if !avatarAllowedTypes[imageType] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid avatar image type")
	}

	setSecurityHeaders(c)
	c.Response().Header().Set(echo.HeaderCacheControl, cacheControl)

	return c.Blob(http.StatusOK, imageType, imageData)
}

// =============================================================================
// File Serving Methods
// =============================================================================

// serveMediaStream serves video/audio files using streaming to avoid memory exhaustion.
func (s *FileServerService) serveMediaStream(c *echo.Context, attachment *store.Attachment, contentType string) error {
	setSecurityHeaders(c)
	setMediaHeaders(c, contentType, attachment.Type)

	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		http.ServeFile(c.Response(), c.Request(), s.resolveLocalPath(attachment.Reference))
		return nil

	case storepb.AttachmentStorageType_S3:
		return s.streamS3Object(c, attachment, contentType)

	default:
		// Database storage fallback.
		modTime := time.Unix(attachment.UpdatedTs, 0)
		http.ServeContent(c.Response(), c.Request(), attachment.Filename, modTime, bytes.NewReader(attachment.Blob))
		return nil
	}
}

// serveStaticFile serves non-streaming files (images, documents, etc.).
func (s *FileServerService) serveStaticFile(c *echo.Context, attachment *store.Attachment, contentType string, wantThumbnail bool) error {
	// Generate thumbnail for supported image types.
	if wantThumbnail && thumbnailSupportedTypes[attachment.Type] {
		if thumbnailBlob, err := s.getOrGenerateThumbnail(c.Request().Context(), attachment); err != nil {
			if !errors.Is(err, errUseOriginalForThumbnail) {
				slog.Warn("failed to get thumbnail", "error", err)
			}
		} else {
			setSecurityHeaders(c)
			setMediaHeaders(c, "image/jpeg", attachment.Type)
			return c.Blob(http.StatusOK, "image/jpeg", thumbnailBlob)
		}
	}

	setSecurityHeaders(c)
	setMediaHeaders(c, contentType, attachment.Type)

	// Force download for non-media files to prevent XSS execution.
	if !strings.HasPrefix(contentType, "image/") && contentType != "application/pdf" {
		c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=%q", attachment.Filename))
	}

	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		http.ServeFile(c.Response(), c.Request(), s.resolveLocalPath(attachment.Reference))
		return nil
	case storepb.AttachmentStorageType_S3:
		return s.streamS3Object(c, attachment, contentType)
	default:
		return c.Blob(http.StatusOK, contentType, attachment.Blob)
	}
}

// =============================================================================
// Storage Operations
// =============================================================================

// getAttachmentBlob retrieves the binary content of an attachment from storage.
func (s *FileServerService) getAttachmentBlob(ctx context.Context, attachment *store.Attachment) ([]byte, error) {
	reader, err := s.getAttachmentReader(ctx, attachment)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	blob, err := io.ReadAll(reader)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read attachment content")
	}
	return blob, nil
}

// getAttachmentReader returns a reader for streaming attachment content.
func (s *FileServerService) getAttachmentReader(ctx context.Context, attachment *store.Attachment) (io.ReadCloser, error) {
	switch attachment.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		file, err := os.Open(s.resolveLocalPath(attachment.Reference))
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open file")
		}
		return file, nil

	case storepb.AttachmentStorageType_S3:
		driver, s3Object, err := s.Store.ResolveAttachmentS3Driver(ctx, attachment)
		if err != nil {
			return nil, err
		}
		object, err := driver.GetObjectStream(ctx, s3Object.Key, "")
		if err != nil {
			return nil, errors.Wrap(err, "failed to stream from S3")
		}
		return object.Body, nil

	default:
		return io.NopCloser(bytes.NewReader(attachment.Blob)), nil
	}
}

// resolveLocalPath converts a storage reference to an absolute file path.
func (s *FileServerService) resolveLocalPath(reference string) string {
	filePath := filepath.FromSlash(reference)
	if !filepath.IsAbs(filePath) {
		filePath = filepath.Join(s.Profile.Data, filePath)
	}
	return filePath
}

// streamS3Object streams S3 content through the server, forwarding a supported
// single Range so media players and document viewers can seek without a direct
// S3 URL. Multipart ranges are ignored and served as a complete response
// because S3 does not support multipart range responses.
func (s *FileServerService) streamS3Object(c *echo.Context, attachment *store.Attachment, contentType string) error {
	ctx := c.Request().Context()
	driver, s3Object, err := s.Store.ResolveAttachmentS3Driver(ctx, attachment)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to resolve S3 attachment driver").Wrap(err)
	}

	object, err := driver.GetObjectStream(ctx, s3Object.Key, singleRangeHeader(c.Request().Header))
	if err != nil {
		if errors.Is(err, storage.ErrRangeNotSatisfiable) {
			h := c.Response().Header()
			h.Set("Accept-Ranges", "bytes")
			var rangeErr *storage.RangeNotSatisfiableError
			if errors.As(err, &rangeErr) && rangeErr.ContentRange != "" {
				h.Set("Content-Range", rangeErr.ContentRange)
			}
			return echo.NewHTTPError(http.StatusRequestedRangeNotSatisfiable, "requested range not satisfiable")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to stream from S3").Wrap(err)
	}
	defer object.Body.Close()

	h := c.Response().Header()
	h.Set("Accept-Ranges", "bytes")
	if object.ContentLength >= 0 {
		h.Set(echo.HeaderContentLength, strconv.FormatInt(object.ContentLength, 10))
	}
	status := http.StatusOK
	if object.ContentRange != "" {
		h.Set("Content-Range", object.ContentRange)
		status = http.StatusPartialContent
	}
	return c.Stream(status, contentType, object.Body)
}

// singleRangeHeader returns a Range value only when it contains one range.
// Ignoring unsupported Range requests is permitted by HTTP and lets the caller
// send the complete representation instead of relaying a request S3 rejects.
func singleRangeHeader(header http.Header) string {
	values := header.Values("Range")
	if len(values) != 1 || strings.Contains(values[0], ",") {
		return ""
	}
	unit, ranges, ok := strings.Cut(values[0], "=")
	if !ok || !strings.EqualFold(strings.TrimSpace(unit), "bytes") || strings.TrimSpace(ranges) == "" {
		return ""
	}
	return values[0]
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
	if blob, err := os.ReadFile(thumbnailPath); err == nil {
		return blob, nil
	}

	useOriginal, err := s.shouldUseOriginalForThumbnail(ctx, attachment)
	if err != nil {
		return nil, err
	}
	if useOriginal {
		return nil, errUseOriginalForThumbnail
	}

	// Acquire semaphore to limit concurrent generation.
	if err := s.thumbnailSemaphore.Acquire(ctx, 1); err != nil {
		return nil, errors.Wrap(err, "failed to acquire semaphore")
	}
	defer s.thumbnailSemaphore.Release(1)

	// Double-check after acquiring semaphore (another goroutine may have generated it).
	if blob, err := os.ReadFile(thumbnailPath); err == nil {
		return blob, nil
	}

	return s.generateThumbnail(ctx, attachment, thumbnailPath)
}

// getThumbnailPath returns the file path for a cached thumbnail.
func (s *FileServerService) getThumbnailPath(attachment *store.Attachment) (string, error) {
	cacheFolder := filepath.Join(s.Profile.Data, thumbnailCacheFolder)
	if err := os.MkdirAll(cacheFolder, os.ModePerm); err != nil {
		return "", errors.Wrap(err, "failed to create thumbnail cache folder")
	}
	filename := fmt.Sprintf("%s.v2.jpeg", attachment.UID)
	return filepath.Join(cacheFolder, filename), nil
}

func (s *FileServerService) shouldUseOriginalForThumbnail(ctx context.Context, attachment *store.Attachment) (bool, error) {
	if attachment.Type == "image/heic" || attachment.Type == "image/heif" {
		return true, nil
	}

	if attachment.Type != "image/jpeg" && attachment.Type != "image/jpg" && attachment.Type != "image/png" && attachment.Type != "image/webp" {
		return false, nil
	}

	reader, err := s.getAttachmentReader(ctx, attachment)
	if err != nil {
		return false, errors.Wrap(err, "failed to open image for metadata probe")
	}
	defer reader.Close()

	probe, err := io.ReadAll(io.LimitReader(reader, thumbnailMetadataProbeSize))
	if err != nil {
		return false, errors.Wrap(err, "failed to read image metadata probe")
	}

	return hasThumbnailSensitiveMetadata(probe), nil
}

func hasThumbnailSensitiveMetadata(data []byte) bool {
	for _, marker := range [][]byte{
		[]byte("ICC_PROFILE"),
		[]byte("iCCP"),
		[]byte("ICCP"),
		[]byte("cICP"),
		[]byte("mDCv"),
		[]byte("cLLi"),
	} {
		if bytes.Contains(data, marker) {
			return true
		}
	}

	lowerData := strings.ToLower(string(data))
	for _, marker := range []string{
		"hdrgm:",
		"hdr gain map",
		"hdrgainmap",
		"gainmap",
		"ultrahdr",
		"adobe:hdrgainmap",
		"aux:hdr",
		"auxiliaryimagetype",
		"display p3",
		"display-p3",
		"rec.2020",
		"bt.2020",
		"arib-std-b67",
		"smpte st 2084",
	} {
		if strings.Contains(lowerData, marker) {
			return true
		}
	}

	return false
}

// generateThumbnail creates a new thumbnail and saves it to disk.
func (s *FileServerService) generateThumbnail(ctx context.Context, attachment *store.Attachment, thumbnailPath string) ([]byte, error) {
	reader, err := s.getAttachmentReader(ctx, attachment)
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

	var buf bytes.Buffer
	if err := imaging.Encode(&buf, thumbnailImage, imaging.JPEG, imaging.JPEGQuality(90)); err != nil {
		return nil, errors.Wrap(err, "failed to encode thumbnail")
	}
	if err := os.WriteFile(thumbnailPath, buf.Bytes(), 0644); err != nil {
		return nil, errors.Wrap(err, "failed to save thumbnail")
	}

	return buf.Bytes(), nil
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

func (s *FileServerService) serveMotionClip(c *echo.Context, attachment *store.Attachment) error {
	motionMedia := attachment.Payload.GetMotionMedia()
	if motionMedia == nil || motionMedia.Family != storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO || !motionMedia.HasEmbeddedVideo {
		return echo.NewHTTPError(http.StatusBadRequest, "attachment does not have motion clip")
	}

	clipBlob, err := s.getOrExtractMotionClip(c.Request().Context(), attachment)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get motion clip").Wrap(err)
	}

	setSecurityHeaders(c)
	setMediaHeaders(c, "video/mp4", "video/mp4")
	modTime := time.Unix(attachment.UpdatedTs, 0)
	http.ServeContent(c.Response(), c.Request(), attachment.UID+".mp4", modTime, bytes.NewReader(clipBlob))
	return nil
}

func (s *FileServerService) getOrExtractMotionClip(ctx context.Context, attachment *store.Attachment) ([]byte, error) {
	motionPath, err := s.getMotionPath(attachment)
	if err != nil {
		return nil, err
	}

	if blob, err := os.ReadFile(motionPath); err == nil {
		return blob, nil
	}

	blob, err := s.getAttachmentBlob(ctx, attachment)
	if err != nil {
		return nil, err
	}

	videoBlob, _ := motionphoto.ExtractVideo(blob)
	if len(videoBlob) == 0 {
		return nil, errors.New("motion video not found")
	}

	if err := os.WriteFile(motionPath, videoBlob, 0644); err != nil {
		return nil, errors.Wrap(err, "failed to cache motion clip")
	}

	return videoBlob, nil
}

func (s *FileServerService) getMotionPath(attachment *store.Attachment) (string, error) {
	cacheFolder := filepath.Join(s.Profile.Data, motionCacheFolder)
	if err := os.MkdirAll(cacheFolder, os.ModePerm); err != nil {
		return "", errors.Wrap(err, "failed to create motion cache folder")
	}

	return filepath.Join(cacheFolder, attachment.UID+".mp4"), nil
}

// =============================================================================
// Authentication & Authorization
// =============================================================================

// checkAttachmentPermission verifies the user has permission to access the attachment.
func (s *FileServerService) checkAttachmentPermission(ctx context.Context, c *echo.Context, attachment *store.Attachment) (access.MemoReadClass, error) {
	// For unlinked attachments, only the creator can access.
	if attachment.MemoID == nil {
		user, err := s.getCurrentUser(ctx, c)
		if err != nil {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").Wrap(err)
		}
		if user == nil {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
		}
		if user.ID != attachment.CreatorID && user.Role != store.RoleAdmin {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusForbidden, "forbidden access")
		}
		return access.MemoReadClassPrivate, nil
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
	if err != nil {
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to find memo").Wrap(err)
	}
	if memo == nil {
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}

	var parent *store.Memo
	if memo.ParentUID != nil {
		parent, err = s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to find parent memo").Wrap(err)
		}
		if parent == nil {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusNotFound, "memo not found")
		}
	}

	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to get instance access policy").Wrap(err)
	}
	if decision := access.CheckMemoRead(memo, parent, nil, allowAnonymous, nil); decision.Allowed() {
		return decision.Class, nil
	}

	var sharedMemoID *int32
	if shareToken := (*c).QueryParam("share_token"); shareToken != "" {
		ms, err := s.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: &shareToken})
		if err != nil {
			return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to get memo share").Wrap(err)
		}
		if ms != nil && !isMemoShareExpired(ms) {
			sharedMemoID = &ms.MemoID
			if decision := access.CheckMemoRead(memo, parent, nil, allowAnonymous, sharedMemoID); decision.Allowed() {
				return decision.Class, nil
			}
		}
	}

	user, err := s.getCurrentUser(ctx, c)
	if err != nil {
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").Wrap(err)
	}
	decision := access.CheckMemoRead(memo, parent, user, allowAnonymous, sharedMemoID)
	switch decision.Denial {
	case access.MemoReadDenialNone:
		return decision.Class, nil
	case access.MemoReadDenialNotFound:
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusNotFound, "memo not found")
	case access.MemoReadDenialUnauthenticated:
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
	default:
		return access.MemoReadClassPrivate, echo.NewHTTPError(http.StatusForbidden, "forbidden access")
	}
}

// getCurrentUser retrieves the current authenticated user from the request.
// Authentication priority: Bearer token (Access Token V2 or PAT) > Refresh token cookie.
func (s *FileServerService) getCurrentUser(ctx context.Context, c *echo.Context) (*store.User, error) {
	authHeader := c.Request().Header.Get(echo.HeaderAuthorization)
	cookieHeader := c.Request().Header.Get("Cookie")
	return s.authenticator.AuthenticateToUser(ctx, authHeader, cookieHeader)
}

// =============================================================================
// Helper Functions
// =============================================================================

// sanitizeContentType converts potentially dangerous MIME types to safe alternatives.
func sanitizeContentType(mimeType string) string {
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
func parseDataURI(dataURI string) (string, []byte, error) {
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
func setSecurityHeaders(c *echo.Context) {
	h := c.Response().Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';")
}

// setMediaHeaders sets headers for media file responses.
func setMediaHeaders(c *echo.Context, contentType, originalType string) {
	h := c.Response().Header()
	h.Set(echo.HeaderContentType, contentType)
	if h.Get(echo.HeaderCacheControl) == "" {
		h.Set(echo.HeaderCacheControl, cacheMaxAge)
	}

	// Support HDR/wide color gamut for images and videos.
	if strings.HasPrefix(originalType, "image/") || strings.HasPrefix(originalType, "video/") {
		h.Set("Color-Gamut", "srgb, p3, rec2020")
	}
}

// isMemoShareExpired returns true if the share has a defined expiry that has already passed.
func isMemoShareExpired(ms *store.MemoShare) bool {
	return ms.ExpiresTs != nil && time.Now().Unix() > *ms.ExpiresTs
}
