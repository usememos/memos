package v1

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common/log"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	"go.uber.org/zap"
)

type SystemStatus struct {
	Host    *User           `json:"host"`
	Profile profile.Profile `json:"profile"`
	DBSize  int64           `json:"dbSize"`

	// System settings
	// Allow sign up.
	AllowSignUp bool `json:"allowSignUp"`
	// Disable public memos.
	DisablePublicMemos bool `json:"disablePublicMemos"`
	// Max upload size.
	MaxUploadSizeMiB int `json:"maxUploadSizeMiB"`
	// Additional style.
	AdditionalStyle string `json:"additionalStyle"`
	// Additional script.
	AdditionalScript string `json:"additionalScript"`
	// Customized server profile, including server name and external url.
	CustomizedProfile CustomizedProfile `json:"customizedProfile"`
	// Storage service ID.
	StorageServiceID int `json:"storageServiceId"`
	// Local storage path.
	LocalStoragePath string `json:"localStoragePath"`
	// Memo display with updated timestamp.
	MemoDisplayWithUpdatedTs bool `json:"memoDisplayWithUpdatedTs"`
}

func (s *APIV1Service) registerSystemRoutes(g *echo.Group) {
	g.GET("/ping", func(c echo.Context) error {
		return c.JSON(http.StatusOK, s.Profile)
	})

	g.GET("/status", func(c echo.Context) error {
		ctx := c.Request().Context()
		systemStatus := SystemStatus{
			Profile:            *s.Profile,
			DBSize:             0,
			AllowSignUp:        false,
			DisablePublicMemos: false,
			MaxUploadSizeMiB:   32,
			AdditionalStyle:    "",
			AdditionalScript:   "",
			CustomizedProfile: CustomizedProfile{
				Name:        "memos",
				LogoURL:     "",
				Description: "",
				Locale:      "en",
				Appearance:  "system",
				ExternalURL: "",
			},
			StorageServiceID:         DatabaseStorage,
			LocalStoragePath:         "assets/{timestamp}_{filename}",
			MemoDisplayWithUpdatedTs: false,
		}

		hostUserType := store.RoleHost
		hostUser, err := s.Store.GetUser(ctx, &store.FindUser{
			Role: &hostUserType,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find host user").SetInternal(err)
		}
		if hostUser != nil {
			systemStatus.Host = converUserFromStore(hostUser)
			// data desensitize
			systemStatus.Host.OpenID = ""
			systemStatus.Host.Email = ""
		}

		systemSettingList, err := s.Store.ListSystemSettings(ctx, &store.FindSystemSetting{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}
		for _, systemSetting := range systemSettingList {
			if systemSetting.Name == SystemSettingServerIDName.String() || systemSetting.Name == SystemSettingSecretSessionName.String() || systemSetting.Name == SystemSettingTelegramBotTokenName.String() {
				continue
			}

			var baseValue any
			err := json.Unmarshal([]byte(systemSetting.Value), &baseValue)
			if err != nil {
				log.Warn("Failed to unmarshal system setting value", zap.String("setting name", systemSetting.Name))
				continue
			}

			switch systemSetting.Name {
			case SystemSettingAllowSignUpName.String():
				systemStatus.AllowSignUp = baseValue.(bool)
			case SystemSettingDisablePublicMemosName.String():
				systemStatus.DisablePublicMemos = baseValue.(bool)
			case SystemSettingMaxUploadSizeMiBName.String():
				systemStatus.MaxUploadSizeMiB = int(baseValue.(float64))
			case SystemSettingAdditionalStyleName.String():
				systemStatus.AdditionalStyle = baseValue.(string)
			case SystemSettingAdditionalScriptName.String():
				systemStatus.AdditionalScript = baseValue.(string)
			case SystemSettingCustomizedProfileName.String():
				customizedProfile := CustomizedProfile{}
				if err := json.Unmarshal([]byte(systemSetting.Value), &customizedProfile); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting customized profile value").SetInternal(err)
				}
				systemStatus.CustomizedProfile = customizedProfile
			case SystemSettingStorageServiceIDName.String():
				systemStatus.StorageServiceID = int(baseValue.(float64))
			case SystemSettingLocalStoragePathName.String():
				systemStatus.LocalStoragePath = baseValue.(string)
			case SystemSettingMemoDisplayWithUpdatedTsName.String():
				systemStatus.MemoDisplayWithUpdatedTs = baseValue.(bool)
			default:
				log.Warn("Unknown system setting name", zap.String("setting name", systemSetting.Name))
			}
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		// Get database size for host user.
		if ok {
			user, err := s.Store.GetUser(ctx, &store.FindUser{
				ID: &userID,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
			}
			if user != nil && user.Role == store.RoleHost {
				fi, err := os.Stat(s.Profile.DSN)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read database fileinfo").SetInternal(err)
				}
				systemStatus.DBSize = fi.Size()
			}
		}
		return c.JSON(http.StatusOK, systemStatus)
	})

	g.POST("/system/vacuum", func(c echo.Context) error {
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

		if err := s.Store.Vacuum(ctx); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to vacuum database").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
