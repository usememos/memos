package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerSystemRoutes(g *echo.Group) {
	g.POST("/system/setting", func(c echo.Context) error {
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

		systemSettingUpsert := &api.SystemSettingUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(systemSettingUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post system setting request").SetInternal(err)
		}
		if err := systemSettingUpsert.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "system setting invalidate").SetInternal(err)
		}

		systemSetting, err := s.Store.UpsertSystemSetting(ctx, systemSettingUpsert)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert system setting").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(systemSetting))
	})

	g.GET("/system/setting", func(c echo.Context) error {
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

		systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(systemSettingList))
	})
}

func (s *Server) getSystemServerID(ctx context.Context) (string, error) {
	serverIDValue, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
		Name: api.SystemSettingServerIDName,
	})
	if err != nil && common.ErrorCode(err) != common.NotFound {
		return "", err
	}
	if serverIDValue == nil || serverIDValue.Value == "" {
		serverIDValue, err = s.Store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
			Name:  api.SystemSettingServerIDName,
			Value: uuid.NewString(),
		})
		if err != nil {
			return "", err
		}
	}
	return serverIDValue.Value, nil
}

func (s *Server) getSystemSecretSessionName(ctx context.Context) (string, error) {
	secretSessionNameValue, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
		Name: api.SystemSettingSecretSessionName,
	})
	if err != nil && common.ErrorCode(err) != common.NotFound {
		return "", err
	}
	if secretSessionNameValue == nil || secretSessionNameValue.Value == "" {
		secretSessionNameValue, err = s.Store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
			Name:  api.SystemSettingSecretSessionName,
			Value: uuid.NewString(),
		})
		if err != nil {
			return "", err
		}
	}
	return secretSessionNameValue.Value, nil
}
