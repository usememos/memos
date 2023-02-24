package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) registerUserRoutes(g *echo.Group) {
	g.POST("/user", func(c echo.Context) error {
		ctx := c.Request().Context()

		userCreate := &api.UserCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(userCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed post user request").SetInternal(err)
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
	}, roleOnlyMiddleware(api.Host))

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
	}, roleOnlyMiddleware(api.Host))

	g.POST("/user/setting", func(c echo.Context) error {
		ctx := c.Request().Context()
		user := c.Get(userContextKey).(*api.User)

		userSettingUpsert := &api.UserSettingUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(userSettingUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed post user setting upsert request").SetInternal(err)
		}
		if err := userSettingUpsert.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user setting format").SetInternal(err)
		}

		userSettingUpsert.UserID = user.ID
		userSetting, err := s.Store.UpsertUserSetting(ctx, userSettingUpsert)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert user setting").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(userSetting))
	}, loginOnlyMiddleware)

	// GET /api/user/me is used to check if the user is logged in.
	g.GET("/user/me", func(c echo.Context) error {
		ctx := c.Request().Context()
		user := c.Get(userContextKey).(*api.User)

		userSettingList, err := s.Store.FindUserSettingList(ctx, &api.UserSettingFind{
			UserID: user.ID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		user.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, composeResponse(user))
	}, loginOnlyMiddleware)

	g.GET("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed user id").SetInternal(err)
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
		currentUser := c.Get(userContextKey).(*api.User)

		if currentUser.Role != api.Host && currentUser.ID != userID {
			return echo.NewHTTPError(http.StatusForbidden, "Access forbidden for current session user").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		userPatch := &api.UserPatch{
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(userPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformed patch user request").SetInternal(err)
		}
		userPatch.ID = userID
		if err := userPatch.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user patch format").SetInternal(err)
		}

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

		user, err := s.Store.PatchUser(ctx, userPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch user").SetInternal(err)
		}

		userSettingList, err := s.Store.FindUserSettingList(ctx, &api.UserSettingFind{
			UserID: userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find userSettingList").SetInternal(err)
		}
		user.UserSettingList = userSettingList
		return c.JSON(http.StatusOK, composeResponse(user))
	}, loginOnlyMiddleware)

	g.DELETE("/user/:id", func(c echo.Context) error {
		ctx := c.Request().Context()
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
	}, roleOnlyMiddleware(api.Host))
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
	s.Collector.Collect(ctx, &metric.Metric{
		Name: string(activity.Type),
	})
	return err
}
