package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api/v1/auth"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
	"golang.org/x/crypto/bcrypt"
)

// Role is the type of a role.
type Role string

const (
	// RoleHost is the HOST role.
	RoleHost Role = "HOST"
	// RoleAdmin is the ADMIN role.
	RoleAdmin Role = "ADMIN"
	// RoleUser is the USER role.
	RoleUser Role = "USER"
)

func (role Role) String() string {
	return string(role)
}

type User struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	Username        string         `json:"username"`
	Role            Role           `json:"role"`
	Email           string         `json:"email"`
	Nickname        string         `json:"nickname"`
	PasswordHash    string         `json:"-"`
	OpenID          string         `json:"openId"`
	AvatarURL       string         `json:"avatarUrl"`
	UserSettingList []*UserSetting `json:"userSettingList"`
}

type CreateUserRequest struct {
	Username string `json:"username"`
	Role     Role   `json:"role"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Password string `json:"password"`
}

func (create CreateUserRequest) Validate() error {
	if len(create.Username) < 3 {
		return fmt.Errorf("username is too short, minimum length is 3")
	}
	if len(create.Username) > 32 {
		return fmt.Errorf("username is too long, maximum length is 32")
	}
	if len(create.Password) < 3 {
		return fmt.Errorf("password is too short, minimum length is 3")
	}
	if len(create.Password) > 512 {
		return fmt.Errorf("password is too long, maximum length is 512")
	}
	if len(create.Nickname) > 64 {
		return fmt.Errorf("nickname is too long, maximum length is 64")
	}
	if create.Email != "" {
		if len(create.Email) > 256 {
			return fmt.Errorf("email is too long, maximum length is 256")
		}
		if !util.ValidateEmail(create.Email) {
			return fmt.Errorf("invalid email format")
		}
	}

	return nil
}

type UpdateUserRequest struct {
	RowStatus   *RowStatus `json:"rowStatus"`
	Username    *string    `json:"username"`
	Email       *string    `json:"email"`
	Nickname    *string    `json:"nickname"`
	Password    *string    `json:"password"`
	ResetOpenID *bool      `json:"resetOpenId"`
	AvatarURL   *string    `json:"avatarUrl"`
}

func (update UpdateUserRequest) Validate() error {
	if update.Username != nil && len(*update.Username) < 3 {
		return fmt.Errorf("username is too short, minimum length is 3")
	}
	if update.Username != nil && len(*update.Username) > 32 {
		return fmt.Errorf("username is too long, maximum length is 32")
	}
	if update.Password != nil && len(*update.Password) < 3 {
		return fmt.Errorf("password is too short, minimum length is 3")
	}
	if update.Password != nil && len(*update.Password) > 512 {
		return fmt.Errorf("password is too long, maximum length is 512")
	}
	if update.Nickname != nil && len(*update.Nickname) > 64 {
		return fmt.Errorf("nickname is too long, maximum length is 64")
	}
	if update.AvatarURL != nil {
		if len(*update.AvatarURL) > 2<<20 {
			return fmt.Errorf("avatar is too large, maximum is 2MB")
		}
	}
	if update.Email != nil && *update.Email != "" {
		if len(*update.Email) > 256 {
			return fmt.Errorf("email is too long, maximum length is 256")
		}
		if !util.ValidateEmail(*update.Email) {
			return fmt.Errorf("invalid email format")
		}
	}

	return nil
}

func (s *APIV1Service) registerUserRoutes(g *echo.Group) {
	// POST /user - Create a new user.
	g.POST("/user", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}
		currentUser, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by id").SetInternal(err)
		}
		if currentUser == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}
		if currentUser.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized to create user")
		}

		userCreate := &CreateUserRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(userCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user request").SetInternal(err)
		}
		if err := userCreate.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user create format").SetInternal(err)
		}
		// Disallow host user to be created.
		if userCreate.Role == RoleHost {
			return echo.NewHTTPError(http.StatusForbidden, "Could not create host user")
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(userCreate.Password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
		}

		user, err := s.Store.CreateUser(ctx, &store.User{
			Username:     userCreate.Username,
			Role:         store.Role(userCreate.Role),
			Email:        userCreate.Email,
			Nickname:     userCreate.Nickname,
			PasswordHash: string(passwordHash),
			OpenID:       util.GenUUID(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user").SetInternal(err)
		}

		userMessage := convertUserFromStore(user)
		if err := s.createUserCreateActivity(c, userMessage); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, userMessage)
	})

	// GET /user - List all users.
	g.GET("/user", func(c echo.Context) error {
		ctx := c.Request().Context()
		list, err := s.Store.ListUsers(ctx, &store.FindUser{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user list").SetInternal(err)
		}

		userMessageList := make([]*User, 0, len(list))
		for _, user := range list {
			userMessage := convertUserFromStore(user)
			// data desensitize
			userMessage.OpenID = ""
			userMessage.Email = ""
			userMessageList = append(userMessageList, userMessage)
		}
		return c.JSON(http.StatusOK, userMessageList)
	})

	// GET /user/me - Get current user.
	g.GET("/user/me", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}

		list, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
			UserID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		userSettingList := []*UserSetting{}
		for _, userSetting := range list {
			userSettingList = append(userSettingList, convertUserSettingFromStore(userSetting))
		}
		userMessage := convertUserFromStore(user)
		userMessage.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, userMessage)
	})

	// GET /user/:id - Get user by id.
	g.GET("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted user id").SetInternal(err)
		}

		user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &id})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}

		userMessage := convertUserFromStore(user)
		// data desensitize
		userMessage.OpenID = ""
		userMessage.Email = ""
		return c.JSON(http.StatusOK, userMessage)
	})

	// GET /user/name/:username - Get user by username.
	// NOTE: This should be moved to /api/v2/user/:username
	g.GET("/user/name/:username", func(c echo.Context) error {
		ctx := c.Request().Context()
		username := c.Param("username")
		user, err := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, "User not found")
		}

		userMessage := convertUserFromStore(user)
		// data desensitize
		userMessage.OpenID = ""
		userMessage.Email = ""
		return c.JSON(http.StatusOK, userMessage)
	})

	// PUT /user/:id - Update user by id.
	g.PATCH("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("id"))).SetInternal(err)
		}

		currentUserID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		currentUser, err := s.Store.GetUser(ctx, &store.FindUser{ID: &currentUserID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if currentUser == nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Current session user not found with ID: %d", currentUserID)).SetInternal(err)
		} else if currentUser.Role != store.RoleHost && currentUserID != userID {
			return echo.NewHTTPError(http.StatusForbidden, "Unauthorized to update user").SetInternal(err)
		}

		request := &UpdateUserRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch user request").SetInternal(err)
		}
		if err := request.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid update user request").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		userUpdate := &store.UpdateUser{
			ID:        userID,
			UpdatedTs: &currentTs,
		}
		if request.RowStatus != nil {
			rowStatus := store.RowStatus(request.RowStatus.String())
			userUpdate.RowStatus = &rowStatus
		}
		if request.Username != nil {
			userUpdate.Username = request.Username
		}
		if request.Email != nil {
			userUpdate.Email = request.Email
		}
		if request.Nickname != nil {
			userUpdate.Nickname = request.Nickname
		}
		if request.Password != nil {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(*request.Password), bcrypt.DefaultCost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
			}

			passwordHashStr := string(passwordHash)
			userUpdate.PasswordHash = &passwordHashStr
		}
		if request.ResetOpenID != nil && *request.ResetOpenID {
			openID := util.GenUUID()
			userUpdate.OpenID = &openID
		}
		if request.AvatarURL != nil {
			userUpdate.AvatarURL = request.AvatarURL
		}

		user, err := s.Store.UpdateUser(ctx, userUpdate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch user").SetInternal(err)
		}

		list, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
			UserID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		userSettingList := []*UserSetting{}
		for _, userSetting := range list {
			userSettingList = append(userSettingList, convertUserSettingFromStore(userSetting))
		}
		userMessage := convertUserFromStore(user)
		userMessage.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, userMessage)
	})

	// DELETE /user/:id - Delete user by id.
	g.DELETE("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		currentUserID, ok := c.Get(auth.UserIDContextKey).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		currentUser, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &currentUserID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if currentUser == nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Current session user not found with ID: %d", currentUserID)).SetInternal(err)
		} else if currentUser.Role != store.RoleHost {
			return echo.NewHTTPError(http.StatusForbidden, "Unauthorized to delete user").SetInternal(err)
		}

		userID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("id"))).SetInternal(err)
		}

		userDelete := &store.DeleteUser{
			ID: userID,
		}
		if err := s.Store.DeleteUser(ctx, userDelete); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete user").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func (s *APIV1Service) createUserCreateActivity(c echo.Context, user *User) error {
	ctx := c.Request().Context()
	payload := ActivityUserCreatePayload{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      ActivityUserCreate.String(),
		Level:     ActivityInfo.String(),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func convertUserFromStore(user *store.User) *User {
	return &User{
		ID:           user.ID,
		RowStatus:    RowStatus(user.RowStatus),
		CreatedTs:    user.CreatedTs,
		UpdatedTs:    user.UpdatedTs,
		Username:     user.Username,
		Role:         Role(user.Role),
		Email:        user.Email,
		Nickname:     user.Nickname,
		PasswordHash: user.PasswordHash,
		OpenID:       user.OpenID,
		AvatarURL:    user.AvatarURL,
	}
}
