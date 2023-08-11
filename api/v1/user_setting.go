package v1

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/store"
	"golang.org/x/exp/slices"
)

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale.
	UserSettingLocaleKey UserSettingKey = "locale"
	// UserSettingAppearanceKey is the key type for user appearance.
	UserSettingAppearanceKey UserSettingKey = "appearance"
	// UserSettingMemoVisibilityKey is the key type for user preference memo default visibility.
	UserSettingMemoVisibilityKey UserSettingKey = "memo-visibility"
	// UserSettingTelegramUserIDKey is the key type for telegram UserID of memos user.
	UserSettingTelegramUserIDKey UserSettingKey = "telegram-user-id"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	case UserSettingAppearanceKey:
		return "appearance"
	case UserSettingMemoVisibilityKey:
		return "memo-visibility"
	case UserSettingTelegramUserIDKey:
		return "telegram-user-id"
	}
	return ""
}

var (
	UserSettingLocaleValue = []string{
		"de",
		"en",
		"es",
		"fr",
		"hi",
		"hr",
		"it",
		"ja",
		"ko",
		"nl",
		"pl",
		"pt-BR",
		"ru",
		"sl",
		"sv",
		"tr",
		"uk",
		"vi",
		"zh-Hans",
		"zh-Hant",
	}
	UserSettingAppearanceValue     = []string{"system", "light", "dark"}
	UserSettingMemoVisibilityValue = []Visibility{Private, Protected, Public}
)

type UserSetting struct {
	UserID int32          `json:"userId"`
	Key    UserSettingKey `json:"key"`
	Value  string         `json:"value"`
}

type UpsertUserSettingRequest struct {
	UserID int32          `json:"-"`
	Key    UserSettingKey `json:"key"`
	Value  string         `json:"value"`
}

func (s *APIV1Service) registerUserSettingRoutes(g *echo.Group) {
	g.POST("/user/setting", s.UpsertUserSetting)
}

// UpsertUserSetting godoc
//
//	@Summary	Upsert user setting
//	@Tags		user-setting
//	@Accept		json
//	@Produce	json
//	@Param		body	body		UpsertUserSettingRequest	true	"Request object."
//	@Success	200		{object}	store.UserSetting			"Created user setting"
//	@Failure	400		{object}	nil							"Malformatted post user setting upsert request | Invalid user setting format"
//	@Failure	401		{object}	nil							"Missing auth session"
//	@Failure	500		{object}	nil							"Failed to upsert user setting"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/user/setting [POST]
func (s *APIV1Service) UpsertUserSetting(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(auth.UserIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
	}

	userSettingUpsert := &UpsertUserSettingRequest{}
	if err := json.NewDecoder(c.Request().Body).Decode(userSettingUpsert); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user setting upsert request").SetInternal(err)
	}
	if err := userSettingUpsert.Validate(); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user setting format").SetInternal(err)
	}

	userSettingUpsert.UserID = userID
	userSetting, err := s.Store.UpsertUserSetting(ctx, &store.UserSetting{
		UserID: userID,
		Key:    userSettingUpsert.Key.String(),
		Value:  userSettingUpsert.Value,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert user setting").SetInternal(err)
	}

	userSettingMessage := convertUserSettingFromStore(userSetting)
	return c.JSON(http.StatusOK, userSettingMessage)
}

func (upsert UpsertUserSettingRequest) Validate() error {
	if upsert.Key == UserSettingLocaleKey {
		localeValue := "en"
		err := json.Unmarshal([]byte(upsert.Value), &localeValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting locale value")
		}
		if !slices.Contains(UserSettingLocaleValue, localeValue) {
			return fmt.Errorf("invalid user setting locale value")
		}
	} else if upsert.Key == UserSettingAppearanceKey {
		appearanceValue := "system"
		err := json.Unmarshal([]byte(upsert.Value), &appearanceValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting appearance value")
		}
		if !slices.Contains(UserSettingAppearanceValue, appearanceValue) {
			return fmt.Errorf("invalid user setting appearance value")
		}
	} else if upsert.Key == UserSettingMemoVisibilityKey {
		memoVisibilityValue := Private
		err := json.Unmarshal([]byte(upsert.Value), &memoVisibilityValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting memo visibility value")
		}
		if !slices.Contains(UserSettingMemoVisibilityValue, memoVisibilityValue) {
			return fmt.Errorf("invalid user setting memo visibility value")
		}
	} else if upsert.Key == UserSettingTelegramUserIDKey {
		var key string
		err := json.Unmarshal([]byte(upsert.Value), &key)
		if err != nil {
			return fmt.Errorf("invalid user setting telegram user id value")
		}
	} else {
		return fmt.Errorf("invalid user setting key")
	}

	return nil
}

func convertUserSettingFromStore(userSetting *store.UserSetting) *UserSetting {
	return &UserSetting{
		UserID: userSetting.UserID,
		Key:    UserSettingKey(userSetting.Key),
		Value:  userSetting.Value,
	}
}
