package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerShortcutRoutes(g *echo.Group) {
	g.POST("/shortcut", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		shortcutCreate := &api.ShortcutCreate{
			CreatorID: userID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(shortcutCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post shortcut request").SetInternal(err)
		}

		shortcut, err := s.Store.CreateShortcut(ctx, shortcutCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create shortcut").SetInternal(err)
		}
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "shortcut created",
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(shortcut)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode shortcut response").SetInternal(err)
		}
		return nil
	})

	g.PATCH("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		currentTs := time.Now().Unix()
		shortcutPatch := &api.ShortcutPatch{
			ID:        shortcutID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(shortcutPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch shortcut request").SetInternal(err)
		}

		shortcut, err := s.Store.PatchShortcut(ctx, shortcutPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch shortcut").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(shortcut)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode shortcut response").SetInternal(err)
		}
		return nil
	})

	g.GET("/shortcut", func(c echo.Context) error {
		ctx := c.Request().Context()
		shortcutFind := &api.ShortcutFind{}

		if userID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			shortcutFind.CreatorID = &userID
		} else {
			userID, ok := c.Get(getUserIDContextKey()).(int)
			if !ok {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find shortcut")
			}

			shortcutFind.CreatorID = &userID
		}

		list, err := s.Store.FindShortcutList(ctx, shortcutFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch shortcut list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode shortcut list response").SetInternal(err)
		}
		return nil
	})

	g.GET("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		shortcutFind := &api.ShortcutFind{
			ID: &shortcutID,
		}
		shortcut, err := s.Store.FindShortcut(ctx, shortcutFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch shortcut by ID %d", *shortcutFind.ID)).SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(shortcut)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode shortcut response").SetInternal(err)
		}
		return nil
	})

	g.DELETE("/shortcut/:shortcutId", func(c echo.Context) error {
		ctx := c.Request().Context()
		shortcutID, err := strconv.Atoi(c.Param("shortcutId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("shortcutId"))).SetInternal(err)
		}

		shortcutDelete := &api.ShortcutDelete{
			ID: &shortcutID,
		}
		if err := s.Store.DeleteShortcut(ctx, shortcutDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Shortcut ID not found: %d", shortcutID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete shortcut").SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})
}
