package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	pluginStorage "github.com/usememos/memos/plugin/storage"
	"github.com/usememos/memos/store"
)

type storageHandler struct {
	store     *store.Store
	clientMap sync.Map
}

type StorageServicer interface {
	GetPathTemplate() string
	StoreFile(ctx context.Context, path, fileType string, reader io.Reader) (externalLink string, err error)
	TrySignLink(ctx context.Context, link string) (string, error)
}

func newStorageHandler(ctx context.Context, store *store.Store) (*storageHandler, error) {
	hdl := storageHandler{
		store: store,
	}

	storages, err := hdl.store.FindStorageList(ctx, &api.StorageFind{})
	if err != nil {
		return nil, err
	}

	for _, v := range storages {
		if _, err = hdl.LoadService(ctx, v); err != nil {
			return nil, err
		}
	}

	return &hdl, nil
}

func (hdl *storageHandler) CheckoutService(ctx context.Context, id int) (StorageServicer, error) {
	ret, ok := hdl.clientMap.Load(id)
	if ok {
		return ret.(StorageServicer), nil
	}

	stg, err := hdl.store.FindStorage(ctx, &api.StorageFind{ID: &id})
	if err != nil {
		return nil, err
	}

	srv, err := hdl.LoadService(ctx, stg)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

func (hdl *storageHandler) LoadService(ctx context.Context, storage *api.Storage) (StorageServicer, error) {
	var srv StorageServicer

	switch storage.Type {
	case api.StorageS3:
		var s3Cfg pluginStorage.S3Config
		err := json.Unmarshal(storage.Config.S3Config, &s3Cfg)
		if err != nil {
			return nil, fmt.Errorf("malformed s3 config: %w", err)
		}
		srv, err = pluginStorage.NewS3Client(ctx, &s3Cfg)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported storage: %s", storage.Type)
	}

	hdl.clientMap.Store(storage.ID, srv)

	return srv, nil
}

func (hdl *storageHandler) UnloadService(id int) {
	hdl.clientMap.Delete(id)
}

func (hdl *storageHandler) MaybeShouldSignExternalLink(ctx context.Context, link string) string {
	var (
		newLink string
		err     error
	)
	hdl.clientMap.Range(func(_, value any) bool {
		newLink, err = value.(StorageServicer).TrySignLink(ctx, link)
		return err != nil || newLink == link
	})

	if newLink != "" {
		link = newLink
	}

	return link
}

func (s *Server) registerStorageRoutes(g *echo.Group) {
	g.POST("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageCreate := &api.StorageCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(storageCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post storage request").SetInternal(err)
		}

		storage, err := s.Store.CreateStorage(ctx, storageCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create storage").SetInternal(err)
		}
		_, err = s.storageHandler.LoadService(ctx, storage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storage))
	})

	g.PATCH("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		storagePatch := &api.StoragePatch{
			ID: storageID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(storagePatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch storage request").SetInternal(err)
		}

		storage, err := s.Store.PatchStorage(ctx, storagePatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch storage").SetInternal(err)
		}
		_, err = s.storageHandler.LoadService(ctx, storage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to load storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storage))
	})

	g.GET("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		// We should only show storage list to host user.
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageList, err := s.Store.FindStorageList(ctx, &api.StorageFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storageList))
	})

	g.DELETE("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil || user.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		systemSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{Name: api.SystemSettingStorageServiceIDName})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		if systemSetting != nil {
			storageServiceID := api.DatabaseStorage
			err = json.Unmarshal([]byte(systemSetting.Value), &storageServiceID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal storage service id").SetInternal(err)
			}
			if storageServiceID == storageID {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Storage service %d is using", storageID))
			}
		}

		if err = s.Store.DeleteStorage(ctx, &api.StorageDelete{ID: storageID}); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Storage ID not found: %d", storageID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete storage").SetInternal(err)
		}
		s.storageHandler.UnloadService(storageID)
		return c.JSON(http.StatusOK, true)
	})
}
