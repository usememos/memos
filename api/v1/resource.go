package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"go.uber.org/zap"

	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/storage/s3"
	"github.com/usememos/memos/server/service/metric"
	"github.com/usememos/memos/store"
)

type Resource struct {
	ID int32 `json:"id"`

	// Standard fields
	CreatorID int32 `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Filename     string `json:"filename"`
	Blob         []byte `json:"-"`
	InternalPath string `json:"-"`
	ExternalLink string `json:"externalLink"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
}

type CreateResourceRequest struct {
	Filename     string `json:"filename"`
	ExternalLink string `json:"externalLink"`
	Type         string `json:"type"`
}

type FindResourceRequest struct {
	ID        *int32  `json:"id"`
	CreatorID *int32  `json:"creatorId"`
	Filename  *string `json:"filename"`
}

type UpdateResourceRequest struct {
	Filename *string `json:"filename"`
}

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	maxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024
)

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func (s *APIV1Service) registerResourceRoutes(g *echo.Group) {
	g.GET("/resource", s.GetResourceList)
	g.POST("/resource", s.CreateResource)
	g.POST("/resource/blob", s.UploadResource)
	g.PATCH("/resource/:resourceId", s.UpdateResource)
	g.DELETE("/resource/:resourceId", s.DeleteResource)
}

// GetResourceList godoc
//
//	@Summary	Get a list of resources
//	@Tags		resource
//	@Produce	json
//	@Param		limit	query		int					false	"Limit"
//	@Param		offset	query		int					false	"Offset"
//	@Success	200		{object}	[]store.Resource	"Resource list"
//	@Failure	401		{object}	nil					"Missing user in session"
//	@Failure	500		{object}	nil					"Failed to fetch resource list"
//	@Router		/api/v1/resource [GET]
func (s *APIV1Service) GetResourceList(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}
	find := &store.FindResource{
		CreatorID: &userID,
	}
	if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		find.Limit = &limit
	}
	if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		find.Offset = &offset
	}

	list, err := s.Store.ListResources(ctx, find)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
	}
	resourceMessageList := []*Resource{}
	for _, resource := range list {
		resourceMessageList = append(resourceMessageList, convertResourceFromStore(resource))
	}
	return c.JSON(http.StatusOK, resourceMessageList)
}

// CreateResource godoc
//
//	@Summary	Create resource
//	@Tags		resource
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateResourceRequest	true	"Request object."
//	@Success	200		{object}	store.Resource			"Created resource"
//	@Failure	400		{object}	nil						"Malformatted post resource request | Invalid external link | Invalid external link scheme | Failed to request %s | Failed to read %s | Failed to read mime from %s"
//	@Failure	401		{object}	nil						"Missing user in session"
//	@Failure	500		{object}	nil						"Failed to save resource | Failed to create resource | Failed to create activity"
//	@Router		/api/v1/resource [POST]
func (s *APIV1Service) CreateResource(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}

	request := &CreateResourceRequest{}
	if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post resource request").SetInternal(err)
	}

	create := &store.Resource{
		CreatorID:    userID,
		Filename:     request.Filename,
		ExternalLink: request.ExternalLink,
		Type:         request.Type,
	}
	if request.ExternalLink != "" {
		// Only allow those external links scheme with http/https
		linkURL, err := url.Parse(request.ExternalLink)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid external link").SetInternal(err)
		}
		if linkURL.Scheme != "http" && linkURL.Scheme != "https" {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid external link scheme")
		}
	}

	resource, err := s.Store.CreateResource(ctx, create)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
	}
	metric.Enqueue("resource create")
	return c.JSON(http.StatusOK, convertResourceFromStore(resource))
}

// UploadResource godoc
//
//	@Summary	Upload resource
//	@Tags		resource
//	@Accept		multipart/form-data
//	@Produce	json
//	@Param		file	formData	file			true	"File to upload"
//	@Success	200		{object}	store.Resource	"Created resource"
//	@Failure	400		{object}	nil				"Upload file not found | File size exceeds allowed limit of %d MiB | Failed to parse upload data"
//	@Failure	401		{object}	nil				"Missing user in session"
//	@Failure	500		{object}	nil				"Failed to get uploading file | Failed to open file | Failed to save resource | Failed to create resource | Failed to create activity"
//	@Router		/api/v1/resource/blob [POST]
func (s *APIV1Service) UploadResource(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}

	// This is the backend default max upload size limit.
	maxUploadSetting := s.Store.GetSystemSettingValueWithDefault(ctx, SystemSettingMaxUploadSizeMiBName.String(), "32")
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

	sourceFile, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file").SetInternal(err)
	}
	defer sourceFile.Close()

	create := &store.Resource{
		CreatorID: userID,
		Filename:  file.Filename,
		Type:      file.Header.Get("Content-Type"),
		Size:      file.Size,
	}
	err = SaveResourceBlob(ctx, s.Store, create, sourceFile)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save resource").SetInternal(err)
	}

	resource, err := s.Store.CreateResource(ctx, create)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
	}
	return c.JSON(http.StatusOK, convertResourceFromStore(resource))
}

// DeleteResource godoc
//
//	@Summary	Delete a resource
//	@Tags		resource
//	@Produce	json
//	@Param		resourceId	path		int		true	"Resource ID"
//	@Success	200			{boolean}	true	"Resource deleted"
//	@Failure	400			{object}	nil		"ID is not a number: %s"
//	@Failure	401			{object}	nil		"Missing user in session"
//	@Failure	404			{object}	nil		"Resource not found: %d"
//	@Failure	500			{object}	nil		"Failed to find resource | Failed to delete resource"
//	@Router		/api/v1/resource/{resourceId} [DELETE]
func (s *APIV1Service) DeleteResource(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}

	resourceID, err := util.ConvertStringToInt32(c.Param("resourceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
	}

	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID:        &resourceID,
		CreatorID: &userID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
	}
	if resource == nil {
		return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Resource not found: %d", resourceID))
	}

	if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
		ID: resourceID,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete resource").SetInternal(err)
	}
	return c.JSON(http.StatusOK, true)
}

// UpdateResource godoc
//
//	@Summary	Update a resource
//	@Tags		resource
//	@Produce	json
//	@Param		resourceId	path		int						true	"Resource ID"
//	@Param		patch		body		UpdateResourceRequest	true	"Patch resource request"
//	@Success	200			{object}	store.Resource			"Updated resource"
//	@Failure	400			{object}	nil						"ID is not a number: %s | Malformatted patch resource request"
//	@Failure	401			{object}	nil						"Missing user in session | Unauthorized"
//	@Failure	404			{object}	nil						"Resource not found: %d"
//	@Failure	500			{object}	nil						"Failed to find resource | Failed to patch resource"
//	@Router		/api/v1/resource/{resourceId} [PATCH]
func (s *APIV1Service) UpdateResource(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}

	resourceID, err := util.ConvertStringToInt32(c.Param("resourceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
	}

	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID: &resourceID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
	}
	if resource == nil {
		return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Resource not found: %d", resourceID))
	}
	if resource.CreatorID != userID {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	request := &UpdateResourceRequest{}
	if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch resource request").SetInternal(err)
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateResource{
		ID:        resourceID,
		UpdatedTs: &currentTs,
	}
	if request.Filename != nil && *request.Filename != "" {
		update.Filename = request.Filename
	}

	resource, err = s.Store.UpdateResource(ctx, update)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch resource").SetInternal(err)
	}
	return c.JSON(http.StatusOK, convertResourceFromStore(resource))
}

func replacePathTemplate(path, filename string) string {
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
		case "{uuid}":
			return util.GenUUID()
		}
		return s
	})
	return path
}

func convertResourceFromStore(resource *store.Resource) *Resource {
	return &Resource{
		ID:           resource.ID,
		CreatorID:    resource.CreatorID,
		CreatedTs:    resource.CreatedTs,
		UpdatedTs:    resource.UpdatedTs,
		Filename:     resource.Filename,
		Blob:         resource.Blob,
		InternalPath: resource.InternalPath,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
	}
}

// SaveResourceBlob save the blob of resource based on the storage config
//
// Depend on the storage config, some fields of *store.ResourceCreate will be changed:
// 1. *DatabaseStorage*: `create.Blob`.
// 2. *LocalStorage*: `create.InternalPath`.
// 3. Others( external service): `create.ExternalLink`.
func SaveResourceBlob(ctx context.Context, s *store.Store, create *store.Resource, r io.Reader) error {
	systemSettingStorageServiceID, err := s.GetSystemSetting(ctx, &store.FindSystemSetting{Name: SystemSettingStorageServiceIDName.String()})
	if err != nil {
		return errors.Wrap(err, "Failed to find SystemSettingStorageServiceIDName")
	}

	storageServiceID := DefaultStorage
	if systemSettingStorageServiceID != nil {
		err = json.Unmarshal([]byte(systemSettingStorageServiceID.Value), &storageServiceID)
		if err != nil {
			return errors.Wrap(err, "Failed to unmarshal storage service id")
		}
	}

	// `DatabaseStorage` means store blob into database
	if storageServiceID == DatabaseStorage {
		fileBytes, err := io.ReadAll(r)
		if err != nil {
			return errors.Wrap(err, "Failed to read file")
		}
		create.Blob = fileBytes
		return nil
	} else if storageServiceID == LocalStorage {
		// `LocalStorage` means save blob into local disk
		systemSettingLocalStoragePath, err := s.GetSystemSetting(ctx, &store.FindSystemSetting{Name: SystemSettingLocalStoragePathName.String()})
		if err != nil {
			return errors.Wrap(err, "Failed to find SystemSettingLocalStoragePathName")
		}
		localStoragePath := "assets/{timestamp}_{filename}"
		if systemSettingLocalStoragePath != nil && systemSettingLocalStoragePath.Value != "" {
			err = json.Unmarshal([]byte(systemSettingLocalStoragePath.Value), &localStoragePath)
			if err != nil {
				return errors.Wrap(err, "Failed to unmarshal SystemSettingLocalStoragePathName")
			}
		}

		internalPath := localStoragePath
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replacePathTemplate(internalPath, create.Filename)
		internalPath = filepath.ToSlash(internalPath)
		create.InternalPath = internalPath

		osPath := filepath.FromSlash(internalPath)
		if !filepath.IsAbs(osPath) {
			osPath = filepath.Join(s.Profile.Data, osPath)
		}
		dir := filepath.Dir(osPath)
		if err = os.MkdirAll(dir, os.ModePerm); err != nil {
			return errors.Wrap(err, "Failed to create directory")
		}
		dst, err := os.Create(osPath)
		if err != nil {
			return errors.Wrap(err, "Failed to create file")
		}
		defer dst.Close()
		_, err = io.Copy(dst, r)
		if err != nil {
			return errors.Wrap(err, "Failed to copy file")
		}

		return nil
	}

	// Others: store blob into external service, such as S3
	storage, err := s.GetStorage(ctx, &store.FindStorage{ID: &storageServiceID})
	if err != nil {
		return errors.Wrap(err, "Failed to find StorageServiceID")
	}
	if storage == nil {
		return errors.Errorf("Storage %d not found", storageServiceID)
	}
	storageMessage, err := ConvertStorageFromStore(storage)
	if err != nil {
		return errors.Wrap(err, "Failed to ConvertStorageFromStore")
	}

	if storageMessage.Type != StorageS3 {
		return errors.Errorf("Unsupported storage type: %s", storageMessage.Type)
	}

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
		return errors.Wrap(err, "Failed to create s3 client")
	}

	filePath := s3Config.Path
	if !strings.Contains(filePath, "{filename}") {
		filePath = filepath.Join(filePath, "{filename}")
	}
	filePath = replacePathTemplate(filePath, create.Filename)

	link, err := s3Client.UploadFile(ctx, filePath, create.Type, r)
	if err != nil {
		return errors.Wrap(err, "Failed to upload via s3 client")
	}

	create.ExternalLink = link
	return nil
}
