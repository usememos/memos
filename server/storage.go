package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

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

		storageCreate.CreatorID = userID
		storage, err := s.Store.CreateStorage(ctx, storageCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create storage").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(storage)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode storage response").SetInternal(err)
		}
		return nil
	})

	g.PATCH("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		storageID, err := strconv.Atoi(c.Param("storageId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("storageId"))).SetInternal(err)
		}

		storage, err := s.Store.FindStorage(ctx, &api.StorageFind{
			ID: &storageID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		if storage.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		currentTs := time.Now().Unix()
		storagePatch := &api.StoragePatch{
			ID:        storageID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(storagePatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch storage request").SetInternal(err)
		}

		storage, err = s.Store.PatchStorage(ctx, storagePatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch storage").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(storage)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.GET("/storage", func(c echo.Context) error {
		ctx := c.Request().Context()
		storageList, err := s.Store.FindStorageList(ctx, &api.StorageFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(storageList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode storage list response").SetInternal(err)
		}
		return nil
	})

	g.DELETE("/storage/:storageId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
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
			storageServiceID := 0
			err = json.Unmarshal([]byte(systemSetting.Value), &storageServiceID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal storage service id").SetInternal(err)
			}
			if storageServiceID == storageID {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Storage service %d is using", storageID))
			}
		}

		storage, err := s.Store.FindStorage(ctx, &api.StorageFind{
			ID: &storageID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find storage").SetInternal(err)
		}
		if storage.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		storageDelete := &api.StorageDelete{
			ID: storageID,
		}

		if err = s.Store.DeleteStorage(ctx, storageDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Storage ID not found: %d", storageID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete storage").SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})
}
