package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/store"
)

type SystemSettingName string

const (
	// SystemSettingServerIDName is the name of server id.
	SystemSettingServerIDName SystemSettingName = "server-id"
	// SystemSettingSecretSessionName is the name of secret session.
	SystemSettingSecretSessionName SystemSettingName = "secret-session"
	// SystemSettingAllowSignUpName is the name of allow signup setting.
	SystemSettingAllowSignUpName SystemSettingName = "allow-signup"
	// SystemSettingDisablePasswordLoginName is the name of disable password login setting.
	SystemSettingDisablePasswordLoginName SystemSettingName = "disable-password-login"
	// SystemSettingDisablePublicMemosName is the name of disable public memos setting.
	SystemSettingDisablePublicMemosName SystemSettingName = "disable-public-memos"
	// SystemSettingMaxUploadSizeMiBName is the name of max upload size setting.
	SystemSettingMaxUploadSizeMiBName SystemSettingName = "max-upload-size-mib"
	// SystemSettingAdditionalStyleName is the name of additional style.
	SystemSettingAdditionalStyleName SystemSettingName = "additional-style"
	// SystemSettingAdditionalScriptName is the name of additional script.
	SystemSettingAdditionalScriptName SystemSettingName = "additional-script"
	// SystemSettingCustomizedProfileName is the name of customized server profile.
	SystemSettingCustomizedProfileName SystemSettingName = "customized-profile"
	// SystemSettingStorageServiceIDName is the name of storage service ID.
	SystemSettingStorageServiceIDName SystemSettingName = "storage-service-id"
	// SystemSettingLocalStoragePathName is the name of local storage path.
	SystemSettingLocalStoragePathName SystemSettingName = "local-storage-path"
	// SystemSettingTelegramBotTokenName is the name of Telegram Bot Token.
	SystemSettingTelegramBotTokenName SystemSettingName = "telegram-bot-token"
	// SystemSettingMemoDisplayWithUpdatedTsName is the name of memo display with updated ts.
	SystemSettingMemoDisplayWithUpdatedTsName SystemSettingName = "memo-display-with-updated-ts"
	// SystemSettingAutoBackupIntervalName is the name of auto backup interval as seconds.
	SystemSettingAutoBackupIntervalName SystemSettingName = "auto-backup-interval"
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
	// ExternalURL is the external url of server. e.g. https://usermemos.com
	ExternalURL string `json:"externalUrl"`
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

	list, err := s.Store.ListSystemSettings(ctx, &store.FindSystemSetting{})
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
//	@Success	200		{object}	store.SystemSetting			"Created system setting"
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
	if systemSettingUpsert.Name == SystemSettingDisablePasswordLoginName {
		var disablePasswordLogin bool
		if err := json.Unmarshal([]byte(systemSettingUpsert.Value), &disablePasswordLogin); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid system setting").SetInternal(err)
		}

		identityProviderList, err := s.Store.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert system setting").SetInternal(err)
		}
		if disablePasswordLogin && len(identityProviderList) == 0 {
			return echo.NewHTTPError(http.StatusForbidden, "Cannot disable passwords if no SSO identity provider is configured.")
		}
	}

	systemSetting, err := s.Store.UpsertSystemSetting(ctx, &store.SystemSetting{
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
	case SystemSettingServerIDName:
		return fmt.Errorf("updating %v is not allowed", settingName)
	case SystemSettingAllowSignUpName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingDisablePasswordLoginName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingDisablePublicMemosName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingMaxUploadSizeMiBName:
		var value int
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingAdditionalStyleName:
		var value string
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingAdditionalScriptName:
		var value string
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingCustomizedProfileName:
		customizedProfile := CustomizedProfile{
			Name:        "memos",
			LogoURL:     "",
			Description: "",
			Locale:      "en",
			Appearance:  "system",
			ExternalURL: "",
		}
		if err := json.Unmarshal([]byte(upsert.Value), &customizedProfile); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingStorageServiceIDName:
		// Note: 0 is the default value(database) for storage service ID.
		value := 0
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
		return nil
	case SystemSettingLocalStoragePathName:
		value := ""
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingAutoBackupIntervalName:
		var value int
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
		if value < 0 {
			return fmt.Errorf("must be positive")
		}
	case SystemSettingTelegramBotTokenName:
		if upsert.Value == "" {
			return nil
		}
		// Bot Token with Reverse Proxy shoule like `http.../bot<token>`
		if strings.HasPrefix(upsert.Value, "http") {
			slashIndex := strings.LastIndexAny(upsert.Value, "/")
			if strings.HasPrefix(upsert.Value[slashIndex:], "/bot") {
				return nil
			}
			return fmt.Errorf("token start with `http` must end with `/bot<token>`")
		}
		fragments := strings.Split(upsert.Value, ":")
		if len(fragments) != 2 {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	case SystemSettingMemoDisplayWithUpdatedTsName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
	default:
		return fmt.Errorf("invalid system setting name")
	}
	return nil
}

func convertSystemSettingFromStore(systemSetting *store.SystemSetting) *SystemSetting {
	return &SystemSetting{
		Name:        SystemSettingName(systemSetting.Name),
		Value:       systemSetting.Value,
		Description: systemSetting.Description,
	}
}
