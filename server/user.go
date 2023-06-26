package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) registerUserRoutes(g *echo.Group) {
	g.POST("/user", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}
		currentUser, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by id").SetInternal(err)
		}
		if currentUser.Role != api.Host {
			return echo.NewHTTPError(http.StatusUnauthorized, "Only Host user can create member")
		}

		userCreate := &api.UserCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(userCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user request").SetInternal(err)
		}
		if userCreate.Role == api.Host {
			return echo.NewHTTPError(http.StatusForbidden, "Could not create host user")
		}
		userCreate.OpenID = common.GenUUID()

		if err := userCreate.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user create format").SetInternal(err)
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(userCreate.Password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
		}

		userCreate.PasswordHash = string(passwordHash)
		user, err := s.Store.CreateUser(ctx, userCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user").SetInternal(err)
		}
		if err := s.createUserCreateActivity(c, user); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.GET("/user", func(c echo.Context) error {
		ctx := c.Request().Context()
		userList, err := s.Store.FindUserList(ctx, &api.UserFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user list").SetInternal(err)
		}

		for _, user := range userList {
			// data desensitize
			user.OpenID = ""
			user.Email = ""
		}
		return c.JSON(http.StatusOK, composeResponse(userList))
	})

	g.POST("/user/setting", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}

		userSettingUpsert := &apiv1.UserSettingUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(userSettingUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user setting upsert request").SetInternal(err)
		}
		if err := userSettingUpsert.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user setting format").SetInternal(err)
		}

		userSettingUpsert.UserID = userID
		userSettingMessage, err := s.Store.UpsertUserSettingV1(ctx, &store.UserSettingMessage{
			UserID: userID,
			Key:    userSettingUpsert.Key.String(),
			Value:  userSettingUpsert.Value,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert user setting").SetInternal(err)
		}
		userSetting := convertUserSettingFromStore(userSettingMessage)
		return c.JSON(http.StatusOK, composeResponse(userSetting))
	})

	// GET /api/user/me is used to check if the user is logged in.
	g.GET("/user/me", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}

		userFind := &api.UserFind{
			ID: &userID,
		}
		user, err := s.Store.FindUser(ctx, userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}

		userSettingMessageList, err := s.Store.ListUserSettings(ctx, &store.FindUserSettingMessage{
			UserID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		userSettingList := []*api.UserSetting{}
		for _, userSettingMessage := range userSettingMessageList {
			userSettingV1 := convertUserSettingFromStore(userSettingMessage)
			userSettingList = append(userSettingList, &api.UserSetting{
				UserID: userSettingV1.UserID,
				Key:    api.UserSettingKey(userSettingV1.Key),
				Value:  userSettingV1.Value,
			})
		}
		user.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.GET("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted user id").SetInternal(err)
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &id,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user").SetInternal(err)
		}

		if user != nil {
			// data desensitize
			user.OpenID = ""
			user.Email = ""
		}
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.PATCH("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("id"))).SetInternal(err)
		}
		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		currentUser, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &currentUserID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if currentUser == nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Current session user not found with ID: %d", currentUserID)).SetInternal(err)
		} else if currentUser.Role != api.Host && currentUserID != userID {
			return echo.NewHTTPError(http.StatusForbidden, "Access forbidden for current session user").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		userPatch := &api.UserPatch{
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(userPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch user request").SetInternal(err)
		}
		userPatch.ID = userID

		if userPatch.Password != nil && *userPatch.Password != "" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(*userPatch.Password), bcrypt.DefaultCost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
			}

			passwordHashStr := string(passwordHash)
			userPatch.PasswordHash = &passwordHashStr
		}

		if userPatch.ResetOpenID != nil && *userPatch.ResetOpenID {
			openID := common.GenUUID()
			userPatch.OpenID = &openID
		}

		if err := userPatch.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user patch format").SetInternal(err)
		}

		user, err := s.Store.PatchUser(ctx, userPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch user").SetInternal(err)
		}

		userSettingMessageList, err := s.Store.ListUserSettings(ctx, &store.FindUserSettingMessage{
			UserID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		userSettingList := []*api.UserSetting{}
		for _, userSettingMessage := range userSettingMessageList {
			userSettingV1 := convertUserSettingFromStore(userSettingMessage)
			userSettingList = append(userSettingList, &api.UserSetting{
				UserID: userSettingV1.UserID,
				Key:    api.UserSettingKey(userSettingV1.Key),
				Value:  userSettingV1.Value,
			})
		}
		user.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.DELETE("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		currentUser, err := s.Store.FindUser(ctx, &api.UserFind{
			ID: &currentUserID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}
		if currentUser == nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Current session user not found with ID: %d", currentUserID)).SetInternal(err)
		} else if currentUser.Role != api.Host {
			return echo.NewHTTPError(http.StatusForbidden, "Access forbidden for current session user").SetInternal(err)
		}

		userID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("id"))).SetInternal(err)
		}

		userDelete := &api.UserDelete{
			ID: userID,
		}
		if err := s.Store.DeleteUser(ctx, userDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("User ID not found: %d", userID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete user").SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})
}

func (s *Server) createUserCreateActivity(c echo.Context, user *api.User) error {
	ctx := c.Request().Context()
	payload := api.ActivityUserCreatePayload{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: user.ID,
		Type:      api.ActivityUserCreate,
		Level:     api.ActivityInfo,
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func convertUserSettingFromStore(userSetting *store.UserSettingMessage) *apiv1.UserSetting {
	return &apiv1.UserSetting{
		UserID: userSetting.UserID,
		Key:    apiv1.UserSettingKey(userSetting.Key),
		Value:  userSetting.Value,
	}
}
