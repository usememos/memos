package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/common/log"
	"go.uber.org/zap"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerSystemRoutes(g *echo.Group) {
	g.GET("/ping", func(c echo.Context) error {
		return c.JSON(http.StatusOK, composeResponse(s.Profile))
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
			hostUser.Email = ""
		}

		systemStatus := api.SystemStatus{
			Host:               hostUser,
			Profile:            *s.Profile,
			DBSize:             0,
			AllowSignUp:        false,
			IgnoreUpgrade:      false,
			DisablePublicMemos: false,
			MaxUploadSizeMiB:   32, // this is the frontend default value
			AdditionalStyle:    "",
			AdditionalScript:   "",
			CustomizedProfile: api.CustomizedProfile{
				Name:        "memos",
				LogoURL:     "",
				Description: "",
				Locale:      "en",
				Appearance:  "system",
				ExternalURL: "",
			},
			StorageServiceID: api.DatabaseStorage,
			LocalStoragePath: "",
		}

		systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}
		for _, systemSetting := range systemSettingList {
			if systemSetting.Name == api.SystemSettingServerIDName || systemSetting.Name == api.SystemSettingSecretSessionName || systemSetting.Name == api.SystemSettingOpenAIConfigName {
				continue
			}

			var baseValue any
			err := json.Unmarshal([]byte(systemSetting.Value), &baseValue)
			if err != nil {
				log.Warn("Failed to unmarshal system setting value", zap.String("setting name", systemSetting.Name.String()))
				continue
			}

			switch systemSetting.Name {
			case api.SystemSettingAllowSignUpName:
				systemStatus.AllowSignUp = baseValue.(bool)

			case api.SystemSettingIgnoreUpgradeName:
				systemStatus.IgnoreUpgrade = baseValue.(bool)

			case api.SystemSettingDisablePublicMemosName:
				systemStatus.DisablePublicMemos = baseValue.(bool)

			case api.SystemSettingMaxUploadSizeMiBName:
				systemStatus.MaxUploadSizeMiB = int(baseValue.(float64))

			case api.SystemSettingAdditionalStyleName:
				systemStatus.AdditionalStyle = baseValue.(string)

			case api.SystemSettingAdditionalScriptName:
				systemStatus.AdditionalScript = baseValue.(string)

			case api.SystemSettingCustomizedProfileName:
				customizedProfile := api.CustomizedProfile{}
				if err := json.Unmarshal([]byte(systemSetting.Value), &customizedProfile); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting customized profile value").SetInternal(err)
				}
				systemStatus.CustomizedProfile = customizedProfile

			case api.SystemSettingStorageServiceIDName:
				systemStatus.StorageServiceID = int(baseValue.(float64))

			case api.SystemSettingLocalStoragePathName:
				systemStatus.LocalStoragePath = baseValue.(string)

			default:
				log.Warn("Unknown system setting name", zap.String("setting name", systemSetting.Name.String()))
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
		return c.JSON(http.StatusOK, composeResponse(systemStatus))
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
		return c.JSON(http.StatusOK, true)
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
