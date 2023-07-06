package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

type Shortcut struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int       `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type CreateShortcutRequest struct {
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type UpdateShortcutRequest struct {
	RowStatus *RowStatus `json:"rowStatus"`
	Title     *string    `json:"title"`
	Payload   *string    `json:"payload"`
}

type ShortcutFind struct {
	ID *int

	// Standard fields
	CreatorID *int

	// Domain specific fields
	Title *string `json:"title"`
}

type ShortcutDelete struct {
	ID *int

	// Standard fields
	CreatorID *int
}

func (s *APIV1Service) registerShortcutRoutes(g *echo.Group) {
	g.POST("/shortcut", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		shortcutCreate := &CreateShortcutRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(shortcutCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post shortcut request").SetInternal(err)
		}

		shortcut, err := s.Store.CreateShortcut(ctx, &store.Shortcut{
			CreatorID: userID,
			Title:     shortcutCreate.Title,
			Payload:   shortcutCreate.Payload,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create shortcut").SetInternal(err)
		}

		shortcutMessage := convertShortcutFromStore(shortcut)
		if err := s.createShortcutCreateActivity(c, shortcutMessage); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, shortcutMessage)
	})

	g.PATCH("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		shortcut, err := s.Store.GetShortcut(ctx, &store.FindShortcut{
			ID: &shortcutID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find shortcut").SetInternal(err)
		}
		if shortcut == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Shortcut not found: %d", shortcutID))
		}
		if shortcut.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		request := &UpdateShortcutRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch shortcut request").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		shortcutUpdate := &store.UpdateShortcut{
			ID:        shortcutID,
			UpdatedTs: &currentTs,
		}
		if request.RowStatus != nil {
			rowStatus := store.RowStatus(*request.RowStatus)
			shortcutUpdate.RowStatus = &rowStatus
		}
		if request.Title != nil {
			shortcutUpdate.Title = request.Title
		}
		if request.Payload != nil {
			shortcutUpdate.Payload = request.Payload
		}

		shortcut, err = s.Store.UpdateShortcut(ctx, shortcutUpdate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch shortcut").SetInternal(err)
		}
		return c.JSON(http.StatusOK, convertShortcutFromStore(shortcut))
	})

	g.GET("/shortcut", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find shortcut")
		}

		list, err := s.Store.ListShortcuts(ctx, &store.FindShortcut{
			CreatorID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get shortcut list").SetInternal(err)
		}
		shortcutMessageList := make([]*Shortcut, 0, len(list))
		for _, shortcut := range list {
			shortcutMessageList = append(shortcutMessageList, convertShortcutFromStore(shortcut))
		}
		return c.JSON(http.StatusOK, shortcutMessageList)
	})

	g.GET("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		shortcut, err := s.Store.GetShortcut(ctx, &store.FindShortcut{
			ID: &shortcutID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch shortcut by ID %d", shortcutID)).SetInternal(err)
		}
		if shortcut == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Shortcut not found: %d", shortcutID))
		}
		return c.JSON(http.StatusOK, convertShortcutFromStore(shortcut))
	})

	g.DELETE("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		shortcut, err := s.Store.GetShortcut(ctx, &store.FindShortcut{
			ID: &shortcutID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find shortcut").SetInternal(err)
		}
		if shortcut == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Shortcut not found: %d", shortcutID))
		}
		if shortcut.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if err := s.Store.DeleteShortcut(ctx, &store.DeleteShortcut{
			ID: &shortcutID,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete shortcut").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func (s *APIV1Service) createShortcutCreateActivity(c echo.Context, shortcut *Shortcut) error {
	ctx := c.Request().Context()
	payload := ActivityShortcutCreatePayload{
		Title:   shortcut.Title,
		Payload: shortcut.Payload,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: shortcut.CreatorID,
		Type:      ActivityShortcutCreate.String(),
		Level:     ActivityInfo.String(),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func convertShortcutFromStore(shortcut *store.Shortcut) *Shortcut {
	return &Shortcut{
		ID:        shortcut.ID,
		RowStatus: RowStatus(shortcut.RowStatus),
		CreatorID: shortcut.CreatorID,
		Title:     shortcut.Title,
		Payload:   shortcut.Payload,
		CreatedTs: shortcut.CreatedTs,
		UpdatedTs: shortcut.UpdatedTs,
	}
}
