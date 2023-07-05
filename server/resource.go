package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/disintegration/imaging"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/common/log"
	"github.com/usememos/memos/plugin/storage/s3"
	"github.com/usememos/memos/store"
	"go.uber.org/zap"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	maxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024

	// thumbnailImagePath is the directory to store image thumbnails.
	thumbnailImagePath = ".thumbnail_cache"
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
		if resourceCreate.ExternalLink != "" {
			// Only allow those external links scheme with http/https
			linkURL, err := url.Parse(resourceCreate.ExternalLink)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Invalid external link").SetInternal(err)
			}
			if linkURL.Scheme != "http" && linkURL.Scheme != "https" {
				return echo.NewHTTPError(http.StatusBadRequest, "Invalid external link scheme")
			}

			if resourceCreate.DownloadToLocal {
				resp, err := http.Get(linkURL.String())
				if err != nil {
					return echo.NewHTTPError(http.StatusBadRequest, "Failed to request "+resourceCreate.ExternalLink)
				}
				defer resp.Body.Close()

				blob, err := io.ReadAll(resp.Body)
				if err != nil {
					return echo.NewHTTPError(http.StatusBadRequest, "Failed to read "+resourceCreate.ExternalLink)
				}
				resourceCreate.Blob = blob

				mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
				if err != nil {
					return echo.NewHTTPError(http.StatusBadRequest, "Failed to read mime from "+resourceCreate.ExternalLink)
				}
				resourceCreate.Type = mediaType

				filename := path.Base(linkURL.Path)
				if path.Ext(filename) == "" {
					extensions, _ := mime.ExtensionsByType(mediaType)
					if len(extensions) > 0 {
						filename += extensions[0]
					}
				}
				resourceCreate.Filename = filename
				resourceCreate.PublicID = common.GenUUID()
				resourceCreate.ExternalLink = ""
			}
		}

		resource, err := s.Store.CreateResource(ctx, resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}
		if err := s.createResourceCreateActivity(ctx, resource); err != nil {
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
		maxUploadSetting := s.Store.GetSystemSettingValueWithDefault(&ctx, apiv1.SystemSettingMaxUploadSizeMiBName.String(), "32")
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
		systemSettingStorageServiceID, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{Name: apiv1.SystemSettingStorageServiceIDName.String()})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		storageServiceID := apiv1.DatabaseStorage
		if systemSettingStorageServiceID != nil {
			err = json.Unmarshal([]byte(systemSettingStorageServiceID.Value), &storageServiceID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal storage service id").SetInternal(err)
			}
		}

		publicID := common.GenUUID()
		if storageServiceID == apiv1.DatabaseStorage {
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
		} else if storageServiceID == apiv1.LocalStorage {
			// filepath.Join() should be used for local file paths,
			// as it handles the os-specific path separator automatically.
			// path.Join() always uses '/' as path separator.
			systemSettingLocalStoragePath, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{Name: apiv1.SystemSettingLocalStoragePathName.String()})
			if err != nil && common.ErrorCode(err) != common.NotFound {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find local storage path setting").SetInternal(err)
			}
			localStoragePath := "assets/{publicid}"
			if systemSettingLocalStoragePath != nil && systemSettingLocalStoragePath.Value != "" {
				err = json.Unmarshal([]byte(systemSettingLocalStoragePath.Value), &localStoragePath)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal local storage path setting").SetInternal(err)
				}
			}
			filePath := filepath.FromSlash(localStoragePath)
			if !strings.Contains(filePath, "{publicid}") {
				filePath = filepath.Join(filePath, "{publicid}")
			}
			filePath = filepath.Join(s.Profile.Data, replacePathTemplate(filePath, file.Filename, publicID+filepath.Ext(file.Filename)))

			dir := filepath.Dir(filePath)
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

			resourceCreate = &api.ResourceCreate{
				CreatorID:    userID,
				Filename:     file.Filename,
				Type:         filetype,
				Size:         size,
				InternalPath: filePath,
			}
		} else {
			storage, err := s.Store.GetStorage(ctx, &store.FindStorage{ID: &storageServiceID})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
			}
			storageMessage, err := apiv1.ConvertStorageFromStore(storage)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to convert storage").SetInternal(err)
			}

			if storageMessage.Type == apiv1.StorageS3 {
				s3Config := storageMessage.Config.S3Config
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
				if !strings.Contains(filePath, "{publicid}") {
					filePath = path.Join(filePath, "{publicid}")
				}
				filePath = replacePathTemplate(filePath, file.Filename, publicID+filepath.Ext(file.Filename))
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
		if err := s.createResourceCreateActivity(ctx, resource); err != nil {
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
			if err := os.Remove(resource.InternalPath); err != nil {
				log.Warn(fmt.Sprintf("failed to delete local file with path %s", resource.InternalPath), zap.Error(err))
			}
		}

		ext := filepath.Ext(resource.Filename)
		thumbnailPath := path.Join(s.Profile.Data, thumbnailImagePath, fmt.Sprintf("%d-%s%s", resource.ID, resource.PublicID, ext))
		if err := os.Remove(thumbnailPath); err != nil {
			log.Warn(fmt.Sprintf("failed to delete local thumbnail with path %s", thumbnailPath), zap.Error(err))
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
	f := func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resourceVisibility, err := CheckResourceVisibility(ctx, s.Store, resourceID)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to get resource visibility").SetInternal(err)
		}

		// Protected resource require a logined user
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if resourceVisibility == store.Protected && (!ok || userID <= 0) {
			return echo.NewHTTPError(http.StatusUnauthorized, "Resource visibility not match").SetInternal(err)
		}

		resourceFind := &api.ResourceFind{
			ID:      &resourceID,
			GetBlob: true,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find resource by ID: %v", resourceID)).SetInternal(err)
		}

		// Private resource require logined user is the creator
		if resourceVisibility == store.Private && (!ok || userID != resource.CreatorID) {
			return echo.NewHTTPError(http.StatusUnauthorized, "Resource visibility not match").SetInternal(err)
		}

		blob := resource.Blob
		if resource.InternalPath != "" {
			resourcePath := resource.InternalPath
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

		if c.QueryParam("thumbnail") == "1" && common.HasPrefixes(resource.Type, "image/png", "image/jpeg") {
			ext := filepath.Ext(resource.Filename)
			thumbnailPath := path.Join(s.Profile.Data, thumbnailImagePath, fmt.Sprintf("%d-%s%s", resource.ID, resource.PublicID, ext))
			thumbnailBlob, err := getOrGenerateThumbnailImage(blob, thumbnailPath)
			if err != nil {
				log.Warn(fmt.Sprintf("failed to get or generate local thumbnail with path %s", thumbnailPath), zap.Error(err))
			} else {
				blob = thumbnailBlob
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
	}
	g.GET("/r/:resourceId", f)
	g.GET("/r/:resourceId/", f)
	g.GET("/r/:resourceId/*", f)
}

func (s *Server) createResourceCreateActivity(ctx context.Context, resource *api.Resource) error {
	payload := apiv1.ActivityResourceCreatePayload{
		Filename: resource.Filename,
		Type:     resource.Type,
		Size:     resource.Size,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.ActivityMessage{
		CreatorID: resource.CreatorID,
		Type:      apiv1.ActivityResourceCreate.String(),
		Level:     apiv1.ActivityInfo.String(),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func replacePathTemplate(path, filename, publicID string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{publicid}":
			return publicID
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

		dstDir := path.Dir(dstPath)
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

func CheckResourceVisibility(ctx context.Context, s *store.Store, resourceID int) (store.Visibility, error) {
	memoResourceFind := &api.MemoResourceFind{
		ResourceID: &resourceID,
	}

	memoResources, err := s.FindMemoResourceList(ctx, memoResourceFind)
	if err != nil {
		return store.Private, err
	}

	// If resource is belongs to no memo, it'll always PRIVATE
	if len(memoResources) == 0 {
		return store.Private, nil
	}

	memoIDs := make([]int, 0, len(memoResources))
	for _, memoResource := range memoResources {
		memoIDs = append(memoIDs, memoResource.MemoID)
	}
	visibilityList, err := s.FindMemosVisibilityList(ctx, memoIDs)
	if err != nil {
		return store.Private, err
	}

	var isProtected bool
	for _, visibility := range visibilityList {
		// If any memo is PUBLIC, resource do
		if visibility == store.Public {
			return store.Public, nil
		}

		if visibility == store.Protected {
			isProtected = true
		}
	}

	// If no memo is PUBLIC, but any memo is PROTECTED, resource do
	if isProtected {
		return store.Protected, nil
	}

	// If all memo is PRIVATE, the resource do
	return store.Private, nil
}
