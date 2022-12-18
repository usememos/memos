package server

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerSystemRoutes(g *echo.Group) {
	g.GET("/ping", func(c echo.Context) error {
		data := s.Profile

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(data)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose system profile").SetInternal(err)
		}
		return nil
	})

	g.GET("/status", func(c echo.Context) error {
		ctx := c.Request().Context()
		hostUserType := api.Host
		hostUserFind := api.UserFind{
			Role: &hostUserType,
		}
		hostUser, err := s.Store.FindUser(ctx, &hostUserFind)
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find host user").SetInternal(err)
		}

		if hostUser != nil {
			// data desensitize
			hostUser.OpenID = ""
		}

		systemStatus := api.SystemStatus{
			Host:             hostUser,
			Profile:          *s.Profile,
			DBSize:           0,
			AllowSignUp:      false,
			AdditionalStyle:  "",
			AdditionalScript: "",
		}

		systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}
		for _, systemSetting := range systemSettingList {
			var value interface{}
			err = json.Unmarshal([]byte(systemSetting.Value), &value)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting").SetInternal(err)
			}

			if systemSetting.Name == api.SystemSettingAllowSignUpName {
				systemStatus.AllowSignUp = value.(bool)
			} else if systemSetting.Name == api.SystemSettingAdditionalStyleName {
				systemStatus.AdditionalStyle = value.(string)
			} else if systemSetting.Name == api.SystemSettingAdditionalScriptName {
				systemStatus.AdditionalScript = value.(string)
			}
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		// Get database size for host user.
		if ok {
			user, err := s.Store.FindUser(ctx, &api.UserFind{
				ID: &userID,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
			}
			if user != nil && user.Role == api.Host {
				fi, err := os.Stat(s.Profile.DSN)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read database fileinfo").SetInternal(err)
				}
				systemStatus.DBSize = fi.Size()
			}
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(systemStatus)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode system status response").SetInternal(err)
		}
		return nil
	})

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
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, "Current signin user not found")
		} else if user.Role != api.Host {
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
		s.Collector.Collect(ctx, &metric.Metric{
			Name:   "systemSetting updated",
			Labels: map[string]string{"field": string(systemSettingUpsert.Name)},
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(systemSetting)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode system setting response").SetInternal(err)
		}
		return nil
	})

	g.GET("/system/setting", func(c echo.Context) error {
		ctx := c.Request().Context()
		systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(systemSettingList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode system setting list response").SetInternal(err)
		}
		return nil
	})

	g.POST("/system/vacuum", func(c echo.Context) error {
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
		if err := s.Store.Vacuum(ctx); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to vacuum database").SetInternal(err)
		}
		c.Response().WriteHeader(http.StatusOK)
		return nil
	})
}
