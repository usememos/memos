package v1

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type SystemStatus struct {
	Host    *User           `json:"host"`
	Profile profile.Profile `json:"profile"`
	DBSize  int64           `json:"dbSize"`

	// System settings
	// Disable password login.
	DisablePasswordLogin bool `json:"disablePasswordLogin"`
	// Disable public memos.
	DisablePublicMemos bool `json:"disablePublicMemos"`
	// Max upload size.
	MaxUploadSizeMiB int `json:"maxUploadSizeMiB"`
	// Customized server profile, including server name and external url.
	CustomizedProfile CustomizedProfile `json:"customizedProfile"`
	// Storage service ID.
	StorageServiceID int32 `json:"storageServiceId"`
	// Local storage path.
	LocalStoragePath string `json:"localStoragePath"`
	// Memo display with updated timestamp.
	MemoDisplayWithUpdatedTs bool `json:"memoDisplayWithUpdatedTs"`
}

func (s *APIV1Service) registerSystemRoutes(g *echo.Group) {
	g.GET("/ping", s.PingSystem)
	g.GET("/status", s.GetSystemStatus)
	g.POST("/system/vacuum", s.ExecVacuum)
}

// PingSystem godoc
//
//	@Summary	Ping the system
//	@Tags		system
//	@Produce	json
//	@Success	200	{boolean}	true	"If succeed to ping the system"
//	@Router		/api/v1/ping [GET]
func (*APIV1Service) PingSystem(c echo.Context) error {
	return c.JSON(http.StatusOK, true)
}

// GetSystemStatus godoc
//
//	@Summary	Get system GetSystemStatus
//	@Tags		system
//	@Produce	json
//	@Success	200	{object}	SystemStatus	"System GetSystemStatus"
//	@Failure	401	{object}	nil				"Missing user in session | Unauthorized"
//	@Failure	500	{object}	nil				"Failed to find host user | Failed to find system setting list | Failed to unmarshal system setting customized profile value"
//	@Router		/api/v1/status [GET]
func (s *APIV1Service) GetSystemStatus(c echo.Context) error {
	ctx := c.Request().Context()

	systemStatus := SystemStatus{
		Profile: profile.Profile{
			Mode:    s.Profile.Mode,
			Version: s.Profile.Version,
		},
		MaxUploadSizeMiB: 32,
		CustomizedProfile: CustomizedProfile{
			Name:       "Memos",
			Locale:     "en",
			Appearance: "system",
		},
		StorageServiceID: DefaultStorage,
		LocalStoragePath: "assets/{timestamp}_{filename}",
	}

	hostUserType := store.RoleHost
	hostUser, err := s.Store.GetUser(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find host user").SetInternal(err)
	}
	if hostUser != nil {
		systemStatus.Host = &User{ID: hostUser.ID}
	}

	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find workspace general setting").SetInternal(err)
	}
	systemStatus.DisablePasswordLogin = workspaceGeneralSetting.DisallowPasswordLogin

	systemSettingList, err := s.Store.ListWorkspaceSettings(ctx, &store.FindWorkspaceSetting{})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
	}
	for _, systemSetting := range systemSettingList {
		var baseValue any
		err := json.Unmarshal([]byte(systemSetting.Value), &baseValue)
		if err != nil {
			// Skip invalid value.
			continue
		}

		switch systemSetting.Name {
		case SystemSettingMaxUploadSizeMiBName.String():
			systemStatus.MaxUploadSizeMiB = int(baseValue.(float64))
		case SystemSettingCustomizedProfileName.String():
			customizedProfile := CustomizedProfile{}
			if err := json.Unmarshal([]byte(systemSetting.Value), &customizedProfile); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting customized profile value").SetInternal(err)
			}
			systemStatus.CustomizedProfile = customizedProfile
		case SystemSettingStorageServiceIDName.String():
			systemStatus.StorageServiceID = int32(baseValue.(float64))
		default:
			// Skip unknown system setting.
		}
	}

	return c.JSON(http.StatusOK, systemStatus)
}

// ExecVacuum godoc
//
//	@Summary	Vacuum the database
//	@Tags		system
//	@Produce	json
//	@Success	200	{boolean}	true	"Database vacuumed"
//	@Failure	401	{object}	nil		"Missing user in session | Unauthorized"
//	@Failure	500	{object}	nil		"Failed to find user | Failed to ExecVacuum database"
//	@Router		/api/v1/system/vacuum [POST]
func (s *APIV1Service) ExecVacuum(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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
}
