package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/common/log"
	"github.com/usememos/memos/plugin/storage/s3"
	"go.uber.org/zap"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	maxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024
)

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func (s *Server) registerResourceRoutes(g *echo.Group) {
	g.POST("/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		resourceCreate := &api.ResourceCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(resourceCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post resource request").SetInternal(err)
		}

		resourceCreate.CreatorID = userID
		// Only allow those external links with http prefix.
		if resourceCreate.ExternalLink != "" && !strings.HasPrefix(resourceCreate.ExternalLink, "http") {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid external link")
		}

		resource, err := s.Store.CreateResource(ctx, resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}
		if err := s.createResourceCreateActivity(c, resource); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(resource))
	})

	g.POST("/resource/blob", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		// This is the backend default max upload size limit.
		maxUploadSetting := s.Store.GetSystemSettingValueOrDefault(&ctx, api.SystemSettingMaxUploadSizeMiBName, "32")
		var settingMaxUploadSizeBytes int
		if settingMaxUploadSizeMiB, err := strconv.Atoi(maxUploadSetting); err == nil {
			settingMaxUploadSizeBytes = settingMaxUploadSizeMiB * MebiByte
		} else {
			log.Warn("Failed to parse max upload size", zap.Error(err))
			settingMaxUploadSizeBytes = 0
		}

		file, err := c.FormFile("file")
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get uploading file").SetInternal(err)
		}
		if file == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file not found").SetInternal(err)
		}

		if file.Size > int64(settingMaxUploadSizeBytes) {
			message := fmt.Sprintf("File size exceeds allowed limit of %d MiB", settingMaxUploadSizeBytes/MebiByte)
			return echo.NewHTTPError(http.StatusBadRequest, message).SetInternal(err)
		}
		if err := c.Request().ParseMultipartForm(maxUploadBufferSizeBytes); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to parse upload data").SetInternal(err)
		}

		filetype := file.Header.Get("Content-Type")
		size := file.Size
		sourceFile, err := file.Open()
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file").SetInternal(err)
		}
		defer sourceFile.Close()

		var resourceCreate *api.ResourceCreate
		systemSettingStorageServiceID, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{Name: api.SystemSettingStorageServiceIDName})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		storageServiceID := api.DatabaseStorage
		if systemSettingStorageServiceID != nil {
			err = json.Unmarshal([]byte(systemSettingStorageServiceID.Value), &storageServiceID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal storage service id").SetInternal(err)
			}
		}
		publicID := common.GenUUID()
		if storageServiceID == api.DatabaseStorage {
			fileBytes, err := io.ReadAll(sourceFile)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read file").SetInternal(err)
			}
			resourceCreate = &api.ResourceCreate{
				CreatorID: userID,
				Filename:  file.Filename,
				Type:      filetype,
				Size:      size,
				Blob:      fileBytes,
			}
		} else if storageServiceID == api.LocalStorage {
			// filepath.Join() should be used for local file paths,
			// as it handles the os-specific path separator automatically.
			// path.Join() always uses '/' as path separator.
			systemSettingLocalStoragePath, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{Name: api.SystemSettingLocalStoragePathName})
			if err != nil && common.ErrorCode(err) != common.NotFound {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find local storage path setting").SetInternal(err)
			}
			localStoragePath := "assets/{timestamp}_{filename}"
			if systemSettingLocalStoragePath != nil {
				err = json.Unmarshal([]byte(systemSettingLocalStoragePath.Value), &localStoragePath)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal local storage path setting").SetInternal(err)
				}
			}
			filePath := filepath.FromSlash(localStoragePath)
			if !strings.Contains(filePath, "{filename}") {
				filePath = filepath.Join(filePath, "{filename}")
			}
			filePath = filepath.Join(s.Profile.Data, replacePathTemplate(filePath, file.Filename))
			dir, filename := filepath.Split(filePath)
			if err = os.MkdirAll(dir, os.ModePerm); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create directory").SetInternal(err)
			}
			dst, err := os.Create(filePath)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create file").SetInternal(err)
			}
			defer dst.Close()
			_, err = io.Copy(dst, sourceFile)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to copy file").SetInternal(err)
			}

			if filetype == "image/jpeg" || filetype == "image/png" {
				_, err := sourceFile.Seek(0, io.SeekStart)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to seek file").SetInternal(err)
				}

				fileBytes, err := io.ReadAll(sourceFile)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load file").SetInternal(err)
				}

				thumbnailBytes, err := common.ResizeImageBlob(fileBytes, 302, filetype)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate thumbnail").SetInternal(err)
				}

				dir := filepath.Join(s.Profile.Data, common.ThumbnailPath)
				if err = os.MkdirAll(dir, os.ModePerm); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create directory").SetInternal(err)
				}
				err = os.WriteFile(filepath.Join(dir, publicID), thumbnailBytes, 0666)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create thumbnail").SetInternal(err)
				}
			}

			resourceCreate = &api.ResourceCreate{
				CreatorID:    userID,
				Filename:     filename,
				Type:         filetype,
				Size:         size,
				InternalPath: filePath,
			}
		} else {
			storage, err := s.Store.FindStorage(ctx, &api.StorageFind{ID: &storageServiceID})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
			}

			if storage.Type == api.StorageS3 {
				s3Config := storage.Config.S3Config
				s3Client, err := s3.NewClient(ctx, &s3.Config{
					AccessKey: s3Config.AccessKey,
					SecretKey: s3Config.SecretKey,
					EndPoint:  s3Config.EndPoint,
					Region:    s3Config.Region,
					Bucket:    s3Config.Bucket,
					URLPrefix: s3Config.URLPrefix,
					URLSuffix: s3Config.URLSuffix,
				})
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to new s3 client").SetInternal(err)
				}

				filePath := s3Config.Path
				if !strings.Contains(filePath, "{filename}") {
					filePath = path.Join(filePath, "{filename}")
				}
				filePath = replacePathTemplate(filePath, file.Filename)
				_, filename := filepath.Split(filePath)
				link, err := s3Client.UploadFile(ctx, filePath, filetype, sourceFile)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload via s3 client").SetInternal(err)
				}
				resourceCreate = &api.ResourceCreate{
					CreatorID:    userID,
					Filename:     filename,
					Type:         filetype,
					Size:         size,
					ExternalLink: link,
				}
			} else {
				return echo.NewHTTPError(http.StatusInternalServerError, "Unsupported storage type")
			}
		}

		resourceCreate.PublicID = publicID
		resource, err := s.Store.CreateResource(ctx, resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}
		if err := s.createResourceCreateActivity(c, resource); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(resource))
	})

	g.GET("/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		resourceFind := &api.ResourceFind{
			CreatorID: &userID,
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			resourceFind.Limit = &limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			resourceFind.Offset = &offset
		}

		list, err := s.Store.FindResourceList(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(list))
	})

	g.PATCH("/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resourceFind := &api.ResourceFind{
			ID: &resourceID,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
		}
		if resource.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		currentTs := time.Now().Unix()
		resourcePatch := &api.ResourcePatch{
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(resourcePatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch resource request").SetInternal(err)
		}

		if resourcePatch.ResetPublicID != nil && *resourcePatch.ResetPublicID {
			publicID := common.GenUUID()
			resourcePatch.PublicID = &publicID
		}

		resourcePatch.ID = resourceID
		resource, err = s.Store.PatchResource(ctx, resourcePatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch resource").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(resource))
	})

	g.DELETE("/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resource, err := s.Store.FindResource(ctx, &api.ResourceFind{
			ID:        &resourceID,
			CreatorID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
		}
		if resource.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if resource.InternalPath != "" {
			err := os.Remove(resource.InternalPath)
			if err != nil {
				log.Warn(fmt.Sprintf("failed to delete local file with path %s", resource.InternalPath), zap.Error(err))
			}

			thumbnailPath := filepath.Join(s.Profile.Data, common.ThumbnailPath, resource.PublicID)
			err = os.Remove(thumbnailPath)
			if err != nil {
				log.Warn(fmt.Sprintf("failed to delete local thumbnail with path %s", thumbnailPath), zap.Error(err))
			}
		}

		resourceDelete := &api.ResourceDelete{
			ID: resourceID,
		}
		if err := s.Store.DeleteResource(ctx, resourceDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Resource ID not found: %d", resourceID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete resource").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func (s *Server) registerResourcePublicRoutes(g *echo.Group) {
	// (DEPRECATED) use /r/:resourceId/:publicId/:filename instead.
	g.GET("/r/:resourceId/:publicId", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}
		publicID, err := url.QueryUnescape(c.Param("publicId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("publicID is invalid: %s", c.Param("publicId"))).SetInternal(err)
		}
		resourceFind := &api.ResourceFind{
			ID:       &resourceID,
			PublicID: &publicID,
			GetBlob:  true,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find resource by ID: %v", resourceID)).SetInternal(err)
		}

		blob := resource.Blob
		if resource.InternalPath != "" {
			src, err := os.Open(resource.InternalPath)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to open the local resource: %s", resource.InternalPath)).SetInternal(err)
			}
			defer src.Close()
			blob, err = io.ReadAll(src)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to read the local resource: %s", resource.InternalPath)).SetInternal(err)
			}
		}

		c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
		c.Response().Writer.Header().Set(echo.HeaderContentSecurityPolicy, "default-src 'self'")
		resourceType := strings.ToLower(resource.Type)
		if strings.HasPrefix(resourceType, "text") {
			resourceType = echo.MIMETextPlainCharsetUTF8
		} else if strings.HasPrefix(resourceType, "video") || strings.HasPrefix(resourceType, "audio") {
			http.ServeContent(c.Response(), c.Request(), resource.Filename, time.Unix(resource.UpdatedTs, 0), bytes.NewReader(blob))
			return nil
		}
		return c.Stream(http.StatusOK, resourceType, bytes.NewReader(blob))
	})

	g.GET("/r/:resourceId/:publicId/:filename", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}
		publicID, err := url.QueryUnescape(c.Param("publicId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("publicID is invalid: %s", c.Param("publicId"))).SetInternal(err)
		}
		filename, err := url.QueryUnescape(c.Param("filename"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("filename is invalid: %s", c.Param("filename"))).SetInternal(err)
		}
		resourceFind := &api.ResourceFind{
			ID:       &resourceID,
			PublicID: &publicID,
			Filename: &filename,
			GetBlob:  true,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find resource by ID: %v", resourceID)).SetInternal(err)
		}

		blob := resource.Blob
		if resource.InternalPath != "" {
			resourcePath := resource.InternalPath
			if c.QueryParam("thumbnail") == "1" && (resource.Type == "image/jpeg" || resource.Type == "image/png") {
				thumbnailPath := filepath.Join(s.Profile.Data, common.ThumbnailPath, resource.PublicID)
				if _, err := os.Stat(thumbnailPath); err == nil {
					resourcePath = thumbnailPath
				}
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

		c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
		c.Response().Writer.Header().Set(echo.HeaderContentSecurityPolicy, "default-src 'self'")
		resourceType := strings.ToLower(resource.Type)
		if strings.HasPrefix(resourceType, "text") {
			resourceType = echo.MIMETextPlainCharsetUTF8
		} else if strings.HasPrefix(resourceType, "video") || strings.HasPrefix(resourceType, "audio") {
			http.ServeContent(c.Response(), c.Request(), resource.Filename, time.Unix(resource.UpdatedTs, 0), bytes.NewReader(blob))
			return nil
		}
		return c.Stream(http.StatusOK, resourceType, bytes.NewReader(blob))
	})
}

func (s *Server) createResourceCreateActivity(c echo.Context, resource *api.Resource) error {
	ctx := c.Request().Context()
	payload := api.ActivityResourceCreatePayload{
		Filename: resource.Filename,
		Type:     resource.Type,
		Size:     resource.Size,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: resource.CreatorID,
		Type:      api.ActivityResourceCreate,
		Level:     api.ActivityInfo,
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func replacePathTemplate(path string, filename string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{filename}":
			return filename
		case "{timestamp}":
			return fmt.Sprintf("%d", t.Unix())
		case "{year}":
			return fmt.Sprintf("%d", t.Year())
		case "{month}":
			return fmt.Sprintf("%02d", t.Month())
		case "{day}":
			return fmt.Sprintf("%02d", t.Day())
		case "{hour}":
			return fmt.Sprintf("%02d", t.Hour())
		case "{minute}":
			return fmt.Sprintf("%02d", t.Minute())
		case "{second}":
			return fmt.Sprintf("%02d", t.Second())
		}
		return s
	})
	return path
}
