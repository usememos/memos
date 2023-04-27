package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/store"
)

func (s *Server) registerMemoRelationRoutes(g *echo.Group) {
	g.GET("/memo/relation/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoIDList, _ := s.Store.ListMemoRelations(ctx, &store.FindMemoRelationMessage{
			MemoID: &memoID,
		})
		return c.JSON(http.StatusOK, composeResponse(memoIDList))
	})

	g.POST("/memo/relation/:memoId/:memoId2/:relationType", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		memoID2, err2 := strconv.Atoi(c.Param("memoId2"))
		relationType := c.Param("relationType")

		if err != nil || err2 != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		// check type_ is valid

		message, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
			MemoID:        memoID,
			RelatedMemoID: memoID2,
			Type:          store.MemoRelationType(relationType),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Create Fail: %s", c.Param("memoId"))).SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(message))
	})

	g.DELETE("/memo/relation/:memoId/:memoId2", func(c echo.Context) error {
		ctx := c.Request().Context()
		relationDelete := &store.DeleteMemoRelationMessage{}

		if memoID, err := strconv.Atoi(c.Param("memoId")); err == nil {
			relationDelete.MemoID = &memoID
		}
		if memoID, err := strconv.Atoi(c.Param("memoId2")); err == nil {
			relationDelete.RelatedMemoID = &memoID
		}
		err := s.Store.DeleteMemoRelation(ctx, relationDelete)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Delete Relation Fail: %s", c.Param("memoId"))).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
