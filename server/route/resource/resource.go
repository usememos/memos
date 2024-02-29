package resource

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/disintegration/imaging"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

const (
	// The key name used to store user id in the context
	// user id is extracted from the jwt token subject field.
	userIDContextKey = "user-id"
	// thumbnailImagePath is the directory to store image thumbnails.
	thumbnailImagePath = ".thumbnail_cache"
)

type ResourceService struct {
	Profile *profile.Profile
	Store   *store.Store
}

func NewResourceService(profile *profile.Profile, store *store.Store) *ResourceService {
	return &ResourceService{
		Profile: profile,
		Store:   store,
	}
}

func (s *ResourceService) RegisterRoutes(g *echo.Group) {
	g.GET("/r/:resourceName", s.streamResource)
	g.GET("/r/:resourceName/*", s.streamResource)
}

func (s *ResourceService) streamResource(c echo.Context) error {
	ctx := c.Request().Context()
	resourceName := c.Param("resourceName")
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ResourceName: &resourceName,
		GetBlob:      true,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find resource by id: %s", resourceName)).SetInternal(err)
	}
	if resource == nil {
		return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Resource not found: %s", resourceName))
	}
	// Check the related memo visibility.
	if resource.MemoID != nil {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: resource.MemoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", resource.MemoID)).SetInternal(err)
		}
		if memo != nil && memo.Visibility != store.Public {
			userID, ok := c.Get(userIDContextKey).(int32)
			if !ok || (memo.Visibility == store.Private && userID != resource.CreatorID) {
				return echo.NewHTTPError(http.StatusUnauthorized, "Resource visibility not match")
			}
		}
	}

	blob := resource.Blob
	if resource.InternalPath != "" {
		resourcePath := filepath.FromSlash(resource.InternalPath)
		if !filepath.IsAbs(resourcePath) {
			resourcePath = filepath.Join(s.Profile.Data, resourcePath)
		}

		src, err := os.Open(resourcePath)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to open the local resource: %s", resourcePath)).SetInternal(err)
		}
		defer src.Close()
		blob, err = io.ReadAll(src)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to read the local resource: %s", resourcePath)).SetInternal(err)
		}
	}

	if c.QueryParam("thumbnail") == "1" && util.HasPrefixes(resource.Type, "image/png", "image/jpeg") {
		ext := filepath.Ext(resource.Filename)
		thumbnailPath := filepath.Join(s.Profile.Data, thumbnailImagePath, fmt.Sprintf("%d%s", resource.ID, ext))
		thumbnailBlob, err := getOrGenerateThumbnailImage(blob, thumbnailPath)
		if err != nil {
			slog.Warn("failed to get or generate thumbnail image", err)
		} else {
			blob = thumbnailBlob
		}
	}

	c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=3600")
	c.Response().Writer.Header().Set(echo.HeaderContentSecurityPolicy, "default-src 'none'; script-src 'none'; img-src 'self'; media-src 'self'; sandbox;")
	c.Response().Writer.Header().Set("Content-Disposition", fmt.Sprintf(`filename="%s"`, resource.Filename))
	resourceType := strings.ToLower(resource.Type)
	if strings.HasPrefix(resourceType, "text") {
		resourceType = echo.MIMETextPlainCharsetUTF8
	} else if strings.HasPrefix(resourceType, "video") || strings.HasPrefix(resourceType, "audio") {
		http.ServeContent(c.Response(), c.Request(), resource.Filename, time.Unix(resource.UpdatedTs, 0), bytes.NewReader(blob))
		return nil
	}
	return c.Stream(http.StatusOK, resourceType, bytes.NewReader(blob))
}

var availableGeneratorAmount int32 = 32

func getOrGenerateThumbnailImage(srcBlob []byte, dstPath string) ([]byte, error) {
	if _, err := os.Stat(dstPath); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, errors.Wrap(err, "failed to check thumbnail image stat")
		}

		if atomic.LoadInt32(&availableGeneratorAmount) <= 0 {
			return nil, errors.New("not enough available generator amount")
		}
		atomic.AddInt32(&availableGeneratorAmount, -1)
		defer func() {
			atomic.AddInt32(&availableGeneratorAmount, 1)
		}()

		reader := bytes.NewReader(srcBlob)
		src, err := imaging.Decode(reader, imaging.AutoOrientation(true))
		if err != nil {
			return nil, errors.Wrap(err, "failed to decode thumbnail image")
		}
		thumbnailImage := imaging.Resize(src, 512, 0, imaging.Lanczos)

		dstDir := filepath.Dir(dstPath)
		if err := os.MkdirAll(dstDir, os.ModePerm); err != nil {
			return nil, errors.Wrap(err, "failed to create thumbnail dir")
		}

		if err := imaging.Save(thumbnailImage, dstPath); err != nil {
			return nil, errors.Wrap(err, "failed to resize thumbnail image")
		}
	}

	dstFile, err := os.Open(dstPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open the local resource")
	}
	defer dstFile.Close()
	dstBlob, err := io.ReadAll(dstFile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read the local resource")
	}
	return dstBlob, nil
}
