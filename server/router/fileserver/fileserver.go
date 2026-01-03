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

const (
	// ThumbnailCacheFolder is the folder name where the thumbnail images are stored.
	ThumbnailCacheFolder = ".thumbnail_cache"
	// thumbnailMaxSize is the maximum size in pixels for the largest dimension of the thumbnail image.
	thumbnailMaxSize = 600
)

var SupportedThumbnailMimeTypes = []string{
	"image/png",
	"image/jpeg",
	"image/heic",
	"image/heif",
	"image/webp",
}

// FileServerService handles HTTP file serving with proper range request support.
// This service bypasses gRPC-Gateway to use native HTTP serving via http.ServeContent(),
// which is required for Safari video/audio playback.
type FileServerService struct {
	Profile       *profile.Profile
	Store         *store.Store
	authenticator *auth.Authenticator

	// thumbnailSemaphore limits concurrent thumbnail generation to prevent memory exhaustion
	thumbnailSemaphore *semaphore.Weighted
}

// NewFileServerService creates a new file server service.
func NewFileServerService(profile *profile.Profile, store *store.Store, secret string) *FileServerService {
	return &FileServerService{
		Profile:            profile,
		Store:              store,
		authenticator:      auth.NewAuthenticator(store, secret),
		thumbnailSemaphore: semaphore.NewWeighted(3), // Limit to 3 concurrent thumbnail generations
	}
}

// RegisterRoutes registers HTTP file serving routes.
func (s *FileServerService) RegisterRoutes(echoServer *echo.Echo) {
	fileGroup := echoServer.Group("/file")

	// Serve attachment binary files
	fileGroup.GET("/attachments/:uid/:filename", s.serveAttachmentFile)

	// Serve user avatar images
	fileGroup.GET("/users/:identifier/avatar", s.serveUserAvatar)
}

// serveAttachmentFile serves attachment binary content using native HTTP.
// This properly handles range requests required by Safari for video/audio playback.
func (s *FileServerService) serveAttachmentFile(c echo.Context) error {
	ctx := c.Request().Context()
	uid := c.Param("uid")
	thumbnail := c.QueryParam("thumbnail") == "true"

	// Get attachment from database
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

	// Check permissions - verify memo visibility if attachment belongs to a memo
	if err := s.checkAttachmentPermission(ctx, c, attachment); err != nil {
		return err
	}

	// Get the binary content
	blob, err := s.getAttachmentBlob(attachment)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment blob").SetInternal(err)
	}

	// Handle thumbnail requests for images
	if thumbnail && s.isImageType(attachment.Type) {
		thumbnailBlob, err := s.getOrGenerateThumbnail(ctx, attachment)
		if err != nil {
			// Log warning but fall back to original image
			c.Logger().Warnf("failed to get thumbnail: %v", err)
		} else {
			blob = thumbnailBlob
		}
	}

	// Determine content type
	contentType := attachment.Type
	if strings.HasPrefix(contentType, "text/") {
		contentType += "; charset=utf-8"
	}
	// Prevent XSS attacks by serving potentially unsafe files as octet-stream
	unsafeTypes := []string{
		"text/html",
		"text/javascript",
		"application/javascript",
		"application/x-javascript",
		"text/xml",
		"application/xml",
		"application/xhtml+xml",
		"image/svg+xml",
	}
	for _, unsafeType := range unsafeTypes {
		if strings.EqualFold(contentType, unsafeType) {
			contentType = "application/octet-stream"
			break
		}
	}

	// Set common headers
	c.Response().Header().Set("Content-Type", contentType)
	c.Response().Header().Set("Cache-Control", "public, max-age=3600")
	// Prevent MIME-type sniffing which could lead to XSS
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	// Defense-in-depth: prevent embedding in frames and restrict content loading
	c.Response().Header().Set("X-Frame-Options", "DENY")
	c.Response().Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';")
	// Support HDR/wide color gamut display for capable browsers
	if strings.HasPrefix(contentType, "image/") || strings.HasPrefix(contentType, "video/") {
		c.Response().Header().Set("Color-Gamut", "srgb, p3, rec2020")
	}

	// Force download for non-media files to prevent XSS execution
	if !strings.HasPrefix(contentType, "image/") &&
		!strings.HasPrefix(contentType, "video/") &&
		!strings.HasPrefix(contentType, "audio/") &&
		contentType != "application/pdf" {
		c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", attachment.Filename))
	}

	// For video/audio: Use http.ServeContent for automatic range request support
	// This is critical for Safari which REQUIRES range request support
	if strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/") {
		// ServeContent automatically handles:
		// - Range request parsing
		// - HTTP 206 Partial Content responses
		// - Content-Range headers
		// - Accept-Ranges: bytes header
		modTime := time.Unix(attachment.UpdatedTs, 0)
		http.ServeContent(c.Response(), c.Request(), attachment.Filename, modTime, bytes.NewReader(blob))
		return nil
	}

	// For other files: Simple blob response
	return c.Blob(http.StatusOK, contentType, blob)
}

// serveUserAvatar serves user avatar images.
// Supports both user ID and username as identifier.
func (s *FileServerService) serveUserAvatar(c echo.Context) error {
	ctx := c.Request().Context()
	identifier := c.Param("identifier")

	// Try to find user by ID or username
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

	// Extract image info from data URI
	imageType, base64Data, err := s.extractImageInfo(user.AvatarURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to extract image info").SetInternal(err)
	}

	// Validate avatar MIME type to prevent XSS
	// Supports standard formats and HDR-capable formats
	allowedAvatarTypes := map[string]bool{
		"image/png":  true,
		"image/jpeg": true,
		"image/jpg":  true,
		"image/gif":  true,
		"image/webp": true,
		"image/heic": true,
		"image/heif": true,
	}
	if !allowedAvatarTypes[imageType] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid avatar image type")
	}

	// Decode base64 data
	imageData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to decode image data").SetInternal(err)
	}

	// Set cache headers for avatars
	c.Response().Header().Set("Content-Type", imageType)
	c.Response().Header().Set("Cache-Control", "public, max-age=3600")
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	// Defense-in-depth: prevent embedding in frames
	c.Response().Header().Set("X-Frame-Options", "DENY")
	c.Response().Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline';")

	return c.Blob(http.StatusOK, imageType, imageData)
}

// getUserByIdentifier finds a user by either ID or username.
func (s *FileServerService) getUserByIdentifier(ctx context.Context, identifier string) (*store.User, error) {
	// Try to parse as ID first
	if userID, err := util.ConvertStringToInt32(identifier); err == nil {
		return s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	}

	// Otherwise, treat as username
	return s.Store.GetUser(ctx, &store.FindUser{Username: &identifier})
}

// extractImageInfo extracts image type and base64 data from a data URI.
// Data URI format: data:image/png;base64,iVBORw0KGgo...
func (*FileServerService) extractImageInfo(dataURI string) (string, string, error) {
	dataURIRegex := regexp.MustCompile(`^data:(?P<type>.+);base64,(?P<base64>.+)`)
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", "", errors.New("invalid data URI format")
	}
	imageType := matches[1]
	base64Data := matches[2]
	return imageType, base64Data, nil
}

// checkAttachmentPermission verifies the user has permission to access the attachment.
func (s *FileServerService) checkAttachmentPermission(ctx context.Context, c echo.Context, attachment *store.Attachment) error {
	// If attachment is not linked to a memo, allow access
	if attachment.MemoID == nil {
		return nil
	}

	// Check memo visibility
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: attachment.MemoID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to find memo").SetInternal(err)
	}
	if memo == nil {
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}

	// Public memos are accessible to everyone
	if memo.Visibility == store.Public {
		return nil
	}

	// For non-public memos, check authentication
	user, err := s.getCurrentUser(ctx, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get current user").SetInternal(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized access")
	}

	// Private memos can only be accessed by the creator
	if memo.Visibility == store.Private && user.ID != attachment.CreatorID {
		return echo.NewHTTPError(http.StatusForbidden, "forbidden access")
	}

	return nil
}

// getCurrentUser retrieves the current authenticated user from the Echo context.
// Authentication priority: Bearer token (Access Token V2 or PAT) > Refresh token cookie.
// Uses the shared Authenticator for consistent authentication logic.
func (s *FileServerService) getCurrentUser(ctx context.Context, c echo.Context) (*store.User, error) {
	// Try Bearer token authentication first
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader != "" {
		token := auth.ExtractBearerToken(authHeader)
		if token != "" {
			// Try Access Token V2 (stateless)
			if !strings.HasPrefix(token, auth.PersonalAccessTokenPrefix) {
				claims, err := s.authenticator.AuthenticateByAccessTokenV2(token)
				if err == nil && claims != nil {
					// Get user from claims
					user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &claims.UserID})
					if err == nil && user != nil {
						return user, nil
					}
				}
			}

			// Try PAT
			if strings.HasPrefix(token, auth.PersonalAccessTokenPrefix) {
				user, _, err := s.authenticator.AuthenticateByPAT(ctx, token)
				if err == nil && user != nil {
					return user, nil
				}
			}
		}
	}

	// Fallback: Try refresh token cookie authentication
	// This allows protected attachments to load even when access token has expired,
	// as long as the user has a valid refresh token cookie.
	cookieHeader := c.Request().Header.Get("Cookie")
	if cookieHeader != "" {
		refreshToken := auth.ExtractRefreshTokenFromCookie(cookieHeader)
		if refreshToken != "" {
			user, _, err := s.authenticator.AuthenticateByRefreshToken(ctx, refreshToken)
			if err == nil && user != nil {
				return user, nil
			}
		}
	}

	// No valid authentication found
	return nil, nil
}

// isImageType checks if the mime type is an image that supports thumbnails.
// Supports standard formats (PNG, JPEG) and HDR-capable formats (HEIC, HEIF, WebP).
func (*FileServerService) isImageType(mimeType string) bool {
	supportedTypes := map[string]bool{
		"image/png":  true,
		"image/jpeg": true,
		"image/heic": true,
		"image/heif": true,
		"image/webp": true,
	}
	return supportedTypes[mimeType]
}

// getAttachmentReader returns a reader for the attachment content.
func (s *FileServerService) getAttachmentReader(attachment *store.Attachment) (io.ReadCloser, error) {
	// For local storage, read the file from the local disk.
	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		attachmentPath := filepath.FromSlash(attachment.Reference)
		if !filepath.IsAbs(attachmentPath) {
			attachmentPath = filepath.Join(s.Profile.Data, attachmentPath)
		}

		file, err := os.Open(attachmentPath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		return file, nil
	}
	// For S3 storage, download the file from S3.
	if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		if attachment.Payload == nil {
			return nil, errors.New("attachment payload is missing")
		}
		s3Object := attachment.Payload.GetS3Object()
		if s3Object == nil {
			return nil, errors.New("S3 object payload is missing")
		}
		if s3Object.S3Config == nil {
			return nil, errors.New("S3 config is missing")
		}
		if s3Object.Key == "" {
			return nil, errors.New("S3 object key is missing")
		}

		s3Client, err := s3.NewClient(context.Background(), s3Object.S3Config)
		if err != nil {
			return nil, errors.Wrap(err, "failed to create S3 client")
		}

		reader, err := s3Client.GetObjectStream(context.Background(), s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get object from S3")
		}
		return reader, nil
	}
	// For database storage, return the blob from the database.
	return io.NopCloser(bytes.NewReader(attachment.Blob)), nil
}

// getAttachmentBlob retrieves the binary content of an attachment from storage.
func (s *FileServerService) getAttachmentBlob(attachment *store.Attachment) ([]byte, error) {
	// For local storage, read the file from the local disk.
	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		attachmentPath := filepath.FromSlash(attachment.Reference)
		if !filepath.IsAbs(attachmentPath) {
			attachmentPath = filepath.Join(s.Profile.Data, attachmentPath)
		}

		file, err := os.Open(attachmentPath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		defer file.Close()
		blob, err := io.ReadAll(file)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read the file")
		}
		return blob, nil
	}
	// For S3 storage, download the file from S3.
	if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		if attachment.Payload == nil {
			return nil, errors.New("attachment payload is missing")
		}
		s3Object := attachment.Payload.GetS3Object()
		if s3Object == nil {
			return nil, errors.New("S3 object payload is missing")
		}
		if s3Object.S3Config == nil {
			return nil, errors.New("S3 config is missing")
		}
		if s3Object.Key == "" {
			return nil, errors.New("S3 object key is missing")
		}

		s3Client, err := s3.NewClient(context.Background(), s3Object.S3Config)
		if err != nil {
			return nil, errors.Wrap(err, "failed to create S3 client")
		}

		blob, err := s3Client.GetObject(context.Background(), s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get object from S3")
		}
		return blob, nil
	}
	// For database storage, return the blob from the database.
	return attachment.Blob, nil
}

// getOrGenerateThumbnail returns the thumbnail image of the attachment.
// Uses semaphore to limit concurrent thumbnail generation and prevent memory exhaustion.
func (s *FileServerService) getOrGenerateThumbnail(ctx context.Context, attachment *store.Attachment) ([]byte, error) {
	thumbnailCacheFolder := filepath.Join(s.Profile.Data, ThumbnailCacheFolder)
	if err := os.MkdirAll(thumbnailCacheFolder, os.ModePerm); err != nil {
		return nil, errors.Wrap(err, "failed to create thumbnail cache folder")
	}
	filePath := filepath.Join(thumbnailCacheFolder, fmt.Sprintf("%d%s", attachment.ID, filepath.Ext(attachment.Filename)))

	// Check if thumbnail already exists
	if _, err := os.Stat(filePath); err == nil {
		// Thumbnail exists, read and return it
		thumbnailFile, err := os.Open(filePath)
		if err != nil {
			return nil, errors.Wrap(err, "failed to open thumbnail file")
		}
		defer thumbnailFile.Close()
		blob, err := io.ReadAll(thumbnailFile)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read thumbnail file")
		}
		return blob, nil
	} else if !os.IsNotExist(err) {
		return nil, errors.Wrap(err, "failed to check thumbnail image stat")
	}

	// Thumbnail doesn't exist, acquire semaphore to limit concurrent generation
	if err := s.thumbnailSemaphore.Acquire(ctx, 1); err != nil {
		return nil, errors.Wrap(err, "failed to acquire thumbnail generation semaphore")
	}
	defer s.thumbnailSemaphore.Release(1)

	// Double-check if thumbnail was created while waiting for semaphore
	if _, err := os.Stat(filePath); err == nil {
		thumbnailFile, err := os.Open(filePath)
		if err != nil {
			return nil, errors.Wrap(err, "failed to open thumbnail file")
		}
		defer thumbnailFile.Close()
		blob, err := io.ReadAll(thumbnailFile)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read thumbnail file")
		}
		return blob, nil
	}

	// Generate the thumbnail
	reader, err := s.getAttachmentReader(attachment)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get attachment reader")
	}
	defer reader.Close()

	// Decode image - this is memory intensive
	img, err := imaging.Decode(reader, imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode thumbnail image")
	}

	// The largest dimension is set to thumbnailMaxSize and the smaller dimension is scaled proportionally.
	// Small images are not enlarged.
	width := img.Bounds().Dx()
	height := img.Bounds().Dy()
	var thumbnailWidth, thumbnailHeight int

	// Only resize if the image is larger than thumbnailMaxSize
	if max(width, height) > thumbnailMaxSize {
		if width >= height {
			// Landscape or square - constrain width, maintain aspect ratio for height
			thumbnailWidth = thumbnailMaxSize
			thumbnailHeight = 0
		} else {
			// Portrait - constrain height, maintain aspect ratio for width
			thumbnailWidth = 0
			thumbnailHeight = thumbnailMaxSize
		}
	} else {
		// Keep original dimensions for small images
		thumbnailWidth = width
		thumbnailHeight = height
	}

	// Resize the image to the calculated dimensions.
	thumbnailImage := imaging.Resize(img, thumbnailWidth, thumbnailHeight, imaging.Lanczos)

	// Save thumbnail to disk
	if err := imaging.Save(thumbnailImage, filePath); err != nil {
		return nil, errors.Wrap(err, "failed to save thumbnail file")
	}

	// Read the saved thumbnail and return it
	thumbnailFile, err := os.Open(filePath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open thumbnail file")
	}
	defer thumbnailFile.Close()
	thumbnailBlob, err := io.ReadAll(thumbnailFile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read thumbnail file")
	}
	return thumbnailBlob, nil
}
