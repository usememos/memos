package v1

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

type SystemSettingName string

const (
	// SystemSettingMaxUploadSizeMiBName is the name of max upload size setting.
	SystemSettingMaxUploadSizeMiBName SystemSettingName = "max-upload-size-mib"
	// SystemSettingCustomizedProfileName is the name of customized server profile.
	SystemSettingCustomizedProfileName SystemSettingName = "customized-profile"
	// SystemSettingStorageServiceIDName is the name of storage service ID.
	SystemSettingStorageServiceIDName SystemSettingName = "storage-service-id"
	// SystemSettingLocalStoragePathName is the name of local storage path.
	SystemSettingLocalStoragePathName SystemSettingName = "local-storage-path"
)
const systemSettingUnmarshalError = `failed to unmarshal value from system setting "%v"`

// CustomizedProfile is the struct definition for SystemSettingCustomizedProfileName system setting item.
type CustomizedProfile struct {
	// Name is the server name, default is `memos`
	Name string `json:"name"`
	// LogoURL is the url of logo image.
	LogoURL string `json:"logoUrl"`
	// Description is the server description.
	Description string `json:"description"`
	// Locale is the server default locale.
	Locale string `json:"locale"`
	// Appearance is the server default appearance.
	Appearance string `json:"appearance"`
}

func (key SystemSettingName) String() string {
	return string(key)
}

type SystemSetting struct {
	Name SystemSettingName `json:"name"`
	// Value is a JSON string with basic value.
	Value       string `json:"value"`
	Description string `json:"description"`
}

type UpsertSystemSettingRequest struct {
	Name        SystemSettingName `json:"name"`
	Value       string            `json:"value"`
	Description string            `json:"description"`
}

func (s *APIV1Service) registerSystemSettingRoutes(g *echo.Group) {
	g.GET("/system/setting", s.GetSystemSettingList)
	g.POST("/system/setting", s.CreateSystemSetting)
}

// GetSystemSettingList godoc
//
//	@Summary	Get a list of system settings
//	@Tags		system-setting
//	@Produce	json
//	@Success	200	{object}	[]SystemSetting	"System setting list"
//	@Failure	401	{object}	nil				"Missing user in session | Unauthorized"
//	@Failure	500	{object}	nil				"Failed to find user | Failed to find system setting list"
//	@Router		/api/v1/system/setting [GET]
func (s *APIV1Service) GetSystemSettingList(c echo.Context) error {
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

	list, err := s.Store.ListWorkspaceSettings(ctx, &store.FindWorkspaceSetting{})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
	}

	systemSettingList := make([]*SystemSetting, 0, len(list))
	for _, systemSetting := range list {
		systemSettingList = append(systemSettingList, convertSystemSettingFromStore(systemSetting))
	}
	return c.JSON(http.StatusOK, systemSettingList)
}

// CreateSystemSetting godoc
//
//	@Summary	Create system setting
//	@Tags		system-setting
//	@Accept		json
//	@Produce	json
//	@Param		body	body		UpsertSystemSettingRequest	true	"Request object."
//	@Failure	400		{object}	nil							"Malformatted post system setting request | invalid system setting"
//	@Failure	401		{object}	nil							"Missing user in session | Unauthorized"
//	@Failure	403		{object}	nil							"Cannot disable passwords if no SSO identity provider is configured."
//	@Failure	500		{object}	nil							"Failed to find user | Failed to upsert system setting"
//	@Router		/api/v1/system/setting [POST]
func (s *APIV1Service) CreateSystemSetting(c echo.Context) error {
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

	systemSettingUpsert := &UpsertSystemSettingRequest{}
	if err := json.NewDecoder(c.Request().Body).Decode(systemSettingUpsert); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post system setting request").SetInternal(err)
	}
	if err := systemSettingUpsert.Validate(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid system setting").SetInternal(err)
	}

	systemSetting, err := s.Store.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
		Name:        systemSettingUpsert.Name.String(),
		Value:       systemSettingUpsert.Value,
		Description: systemSettingUpsert.Description,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert system setting").SetInternal(err)
	}
	return c.JSON(http.StatusOK, convertSystemSettingFromStore(systemSetting))
}

func (upsert UpsertSystemSettingRequest) Validate() error {
	switch settingName := upsert.Name; settingName {
	case SystemSettingMaxUploadSizeMiBName:
		var value int
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return errors.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingCustomizedProfileName:
		customizedProfile := CustomizedProfile{
			Name:        "Memos",
			LogoURL:     "",
			Description: "",
			Locale:      "en",
			Appearance:  "system",
		}
		if err := json.Unmarshal([]byte(upsert.Value), &customizedProfile); err != nil {
			return errors.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingStorageServiceIDName:
		// Note: 0 is the default value(database) for storage service ID.
		value := 0
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return errors.Errorf(systemSettingUnmarshalError, settingName)
		}
		return nil
	case SystemSettingLocalStoragePathName:
		value := ""
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return errors.Errorf(systemSettingUnmarshalError, settingName)
		}

		trimmedValue := strings.TrimSpace(value)
		switch {
		case trimmedValue != value:
			return errors.New("local storage path must not contain leading or trailing whitespace")
		case trimmedValue == "":
			return errors.New("local storage path can't be empty")
		case strings.Contains(trimmedValue, "\\"):
			return errors.New("local storage path must use forward slashes `/`")
		case strings.Contains(trimmedValue, "../"):
			return errors.New("local storage path is not allowed to contain `../`")
		case strings.HasPrefix(trimmedValue, "./"):
			return errors.New("local storage path is not allowed to start with `./`")
		case filepath.IsAbs(trimmedValue) || trimmedValue[0] == '/':
			return errors.New("local storage path must be a relative path")
		case !strings.Contains(trimmedValue, "{filename}"):
			return errors.New("local storage path must contain `{filename}`")
		}
	default:
		return errors.New("invalid system setting name")
	}
	return nil
}

func convertSystemSettingFromStore(systemSetting *store.WorkspaceSetting) *SystemSetting {
	return &SystemSetting{
		Name:        SystemSettingName(systemSetting.Name),
		Value:       systemSetting.Value,
		Description: systemSetting.Description,
	}
}
