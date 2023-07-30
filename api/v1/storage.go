package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api/v1/auth"
	"github.com/usememos/memos/store"
)

const (
	// LocalStorage means the storage service is local file system.
	LocalStorage = -1
	// DatabaseStorage means the storage service is database.
	DatabaseStorage = 0
)

type StorageType string

const (
	StorageS3 StorageType = "S3"
)

func (t StorageType) String() string {
	return string(t)
}

type StorageConfig struct {
	S3Config *StorageS3Config `json:"s3Config"`
}

type StorageS3Config struct {
	EndPoint  string `json:"endPoint"`
	Path      string `json:"path"`
	Region    string `json:"region"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
	URLPrefix string `json:"urlPrefix"`
	URLSuffix string `json:"urlSuffix"`
}

type Storage struct {
	ID     int            `json:"id"`
	Name   string         `json:"name"`
	Type   StorageType    `json:"type"`
	Config *StorageConfig `json:"config"`
}

type CreateStorageRequest struct {
	Name   string         `json:"name"`
	Type   StorageType    `json:"type"`
	Config *StorageConfig `json:"config"`
}

type UpdateStorageRequest struct {
	Type   StorageType    `json:"type"`
	Name   *string        `json:"name"`
	Config *StorageConfig `json:"config"`
}

func (s *APIV1Service) registerStorageRoutes(g *echo.Group) {
	g.POST("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		create := &CreateStorageRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(create); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post storage request").SetInternal(err)
		}

		configString := ""
		if create.Type == StorageS3 && create.Config.S3Config != nil {
			configBytes, err := json.Marshal(create.Config.S3Config)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post storage request").SetInternal(err)
			}
			configString = string(configBytes)
		}

		storage, err := s.Store.CreateStorage(ctx, &store.Storage{
			Name:   create.Name,
			Type:   create.Type.String(),
			Config: configString,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create storage").SetInternal(err)
		}
		storageMessage, err := ConvertStorageFromStore(storage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to convert storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, storageMessage)
	})

	g.PATCH("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		update := &UpdateStorageRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(update); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch storage request").SetInternal(err)
		}
		storageUpdate := &store.UpdateStorage{
			ID: storageID,
		}
		if update.Name != nil {
			storageUpdate.Name = update.Name
		}
		if update.Config != nil {
			if update.Type == StorageS3 {
				configBytes, err := json.Marshal(update.Config.S3Config)
				if err != nil {
					return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post storage request").SetInternal(err)
				}
				configString := string(configBytes)
				storageUpdate.Config = &configString
			}
		}

		storage, err := s.Store.UpdateStorage(ctx, storageUpdate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch storage").SetInternal(err)
		}
		storageMessage, err := ConvertStorageFromStore(storage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to convert storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, storageMessage)
	})

	g.GET("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		// We should only show storage list to host user.
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		list, err := s.Store.ListStorages(ctx, &store.FindStorage{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage list").SetInternal(err)
		}

		storageList := []*Storage{}
		for _, storage := range list {
			storageMessage, err := ConvertStorageFromStore(storage)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to convert storage").SetInternal(err)
			}
			storageList = append(storageList, storageMessage)
		}
		return c.JSON(http.StatusOK, storageList)
	})

	g.DELETE("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		systemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{Name: SystemSettingStorageServiceIDName.String()})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		if systemSetting != nil {
			storageServiceID := DatabaseStorage
			err = json.Unmarshal([]byte(systemSetting.Value), &storageServiceID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal storage service id").SetInternal(err)
			}
			if storageServiceID == storageID {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Storage service %d is using", storageID))
			}
		}

		if err = s.Store.DeleteStorage(ctx, &store.DeleteStorage{ID: storageID}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func ConvertStorageFromStore(storage *store.Storage) (*Storage, error) {
	storageMessage := &Storage{
		ID:     storage.ID,
		Name:   storage.Name,
		Type:   StorageType(storage.Type),
		Config: &StorageConfig{},
	}
	if storageMessage.Type == StorageS3 {
		s3Config := &StorageS3Config{}
		if err := json.Unmarshal([]byte(storage.Config), s3Config); err != nil {
			return nil, err
		}
		storageMessage.Config = &StorageConfig{
			S3Config: s3Config,
		}
	}
	return storageMessage, nil
}
