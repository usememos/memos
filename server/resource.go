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
	"github.com/usememos/memos/plugin/storage/s3"
)

const (
	// The max file size is 32MB.
	maxFileSize = 32 << 20
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

		if err := c.Request().ParseMultipartForm(maxFileSize); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file overload max size").SetInternal(err)
		}

		file, err := c.FormFile("file")
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get uploading file").SetInternal(err)
		}
		if file == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file not found").SetInternal(err)
		}

		filename := file.Filename
		filetype := file.Header.Get("Content-Type")
		size := file.Size
		sourceFile, err := file.Open()
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file").SetInternal(err)
		}
		defer sourceFile.Close()

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

		var resourceCreate *api.ResourceCreate
		if storageServiceID == api.DatabaseStorage {
			// Database storage.
			fileBytes, err := io.ReadAll(sourceFile)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read file").SetInternal(err)
			}
			resourceCreate = &api.ResourceCreate{
				CreatorID: userID,
				Filename:  filename,
				Type:      filetype,
				Size:      size,
				Blob:      fileBytes,
			}
		} else if storageServiceID == api.LocalStorage {
			// Local storage.
			systemSettingLocalStoragePath, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{Name: api.SystemSettingLocalStoragePathName})
			if err != nil && common.ErrorCode(err) != common.NotFound {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find local storage path setting").SetInternal(err)
			}
			localStoragePath := ""
			if systemSettingLocalStoragePath != nil {
				err = json.Unmarshal([]byte(systemSettingLocalStoragePath.Value), &localStoragePath)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal local storage path setting").SetInternal(err)
				}
			}
			filePath := localStoragePath
			if !strings.Contains(filePath, "{filename}") {
				filePath = path.Join(filePath, "{filename}")
			}
			filePath = path.Join(s.Profile.Data, replacePathTemplate(filePath, filename))
			dirPath := filepath.Dir(filePath)
			if err = os.MkdirAll(dirPath, os.ModePerm); err != nil {
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
				var s3FileKey string
				if !strings.Contains(s3Config.Path, "{filename}") {
					s3FileKey = path.Join(s3Config.Path, "{filename}")
				}
				s3FileKey = replacePathTemplate(s3FileKey, filename)
				s3client, err := s3.NewClient(ctx, &s3.Config{
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

				link, err := s3client.UploadFile(ctx, s3FileKey, filetype, sourceFile)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload via s3 client").SetInternal(err)
				}
				resourceCreate = &api.ResourceCreate{
					CreatorID:    userID,
					Filename:     filename,
					Type:         filetype,
					ExternalLink: link,
				}
			} else {
				return echo.NewHTTPError(http.StatusInternalServerError, "Unsupported storage type")
			}
		}

		publicID := common.GenUUID()
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

		if resource.ExternalLink != "" {
			return c.Redirect(http.StatusSeeOther, resource.ExternalLink)
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
