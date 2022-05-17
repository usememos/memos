package server

import (
	"encoding/json"
	"fmt"
	"memos/api"
	"memos/common"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoRoutes(g *echo.Group) {
	g.POST("/memo", func(c echo.Context) error {
		userID := c.Get(getUserIDContextKey()).(int)
		memoCreate := &api.MemoCreate{
			CreatorID: userID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request").SetInternal(err)
		}

		memo, err := s.Store.CreateMemo(memoCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}

		return nil
	})

	g.PATCH("/memo/:memoId", func(c echo.Context) error {
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoPatch := &api.MemoPatch{
			ID: memoID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request").SetInternal(err)
		}

		memo, err := s.Store.PatchMemo(memoPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}

		return nil
	})

	g.GET("/memo", func(c echo.Context) error {
		userID := c.Get(getUserIDContextKey()).(int)
		memoFind := &api.MemoFind{
			CreatorID: &userID,
		}
		rowStatus := c.QueryParam("rowStatus")
		if rowStatus != "" {
			memoFind.RowStatus = &rowStatus
		}

		list, err := s.Store.FindMemoList(memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo list response").SetInternal(err)
		}

		return nil
	})

	g.GET("/memo/:memoId", func(c echo.Context) error {
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoFind := &api.MemoFind{
			ID: &memoID,
		}
		memo, err := s.Store.FindMemo(memoFind)
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}

			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}

		return nil
	})

	g.DELETE("/memo/:memoId", func(c echo.Context) error {
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoDelete := &api.MemoDelete{
			ID: memoID,
		}

		err = s.Store.DeleteMemo(memoDelete)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo ID: %v", memoID)).SetInternal(err)
		}

		c.JSON(http.StatusOK, true)

		return nil
	})
}
