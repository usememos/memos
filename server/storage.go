package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
)

func (s *Server) registerStorageRoutes(g *echo.Group) {
	g.POST("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
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

		storageCreate := &api.StorageCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(storageCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post storage request").SetInternal(err)
		}

		storage, err := s.Store.CreateStorage(ctx, storageCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create storage").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(storage))
	})

	g.PATCH("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
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
		return c.JSON(http.StatusOK, composeResponse(storage))
	})

	g.GET("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
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

		systemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{Name: apiv1.SystemSettingStorageServiceIDName.String()})
		if err != nil {
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
		return c.JSON(http.StatusOK, true)
	})
}
