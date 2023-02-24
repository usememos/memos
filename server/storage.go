package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

func (s *Server) registerStorageRoutes(g *echo.Group) {
	g.POST("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()

		storageCreate := &api.StorageCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(storageCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed post storage request").SetInternal(err)
		}

		storage, err := s.Store.CreateStorage(ctx, storageCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storage))
	}, roleOnlyMiddleware(api.Host))

	g.PATCH("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		storagePatch := &api.StoragePatch{
			ID: storageID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(storagePatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed patch storage request").SetInternal(err)
		}

		storage, err := s.Store.PatchStorage(ctx, storagePatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storage))
	}, roleOnlyMiddleware(api.Host))

	g.GET("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()

		storageList, err := s.Store.FindStorageList(ctx, &api.StorageFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storageList))
	}, roleOnlyMiddleware(api.Host))

	g.DELETE("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		systemSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{Name: api.SystemSettingStorageServiceIDName})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		if systemSetting != nil {
			storageServiceID := 0
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
		return c.JSON(http.StatusOK, true)
	}, roleOnlyMiddleware(api.Host))
}
