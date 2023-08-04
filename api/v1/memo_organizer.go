package v1

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

type MemoOrganizer struct {
	MemoID int32 `json:"memoId"`
	UserID int32 `json:"userId"`
	Pinned bool  `json:"pinned"`
}

type UpsertMemoOrganizerRequest struct {
	Pinned bool `json:"pinned"`
}

func (s *APIV1Service) registerMemoOrganizerRoutes(g *echo.Group) {
	g.POST("/memo/:memoId/organizer", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		userID, ok := c.Get(auth.UserIDContextKey).(int32)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %v", memoID))
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		request := &UpsertMemoOrganizerRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo organizer request").SetInternal(err)
		}

		upsert := &store.MemoOrganizer{
			MemoID: memoID,
			UserID: userID,
			Pinned: request.Pinned,
		}
		_, err = s.Store.UpsertMemoOrganizer(ctx, upsert)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo organizer").SetInternal(err)
		}

		memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %v", memoID))
		}

		memoResponse, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoResponse)
	})
}
