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

	g.POST("/memo/relation/:memoId/:relatedMemoId/:relationType", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		relatedMemoID, err2 := strconv.Atoi(c.Param("relatedMemoId"))
		relationType := c.Param("relationType")

		if err != nil || err2 != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		if relationType != string(store.MemoRelationReference) && relationType != string(store.MemoRelationAdditional) {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Invalid Relation Type: %s", relationType))
		}

		message, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
			MemoID:        memoID,
			RelatedMemoID: relatedMemoID,
			Type:          store.MemoRelationType(relationType),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Create Relation Fail: %v %v", memoID, relatedMemoID)).SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(message))
	})

	g.DELETE("/memo/relation/:memoId/:relatedMemoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		relationDelete := &store.DeleteMemoRelationMessage{}

		if memoID, err := strconv.Atoi(c.Param("memoId")); err == nil {
			relationDelete.MemoID = &memoID
		}
		if relatedMemoId, err := strconv.Atoi(c.Param("relatedMemoId")); err == nil {
			relationDelete.RelatedMemoID = &relatedMemoId
		}
		err := s.Store.DeleteMemoRelation(ctx, relationDelete)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Delete Relation Fail: %s", c.Param("memoId"))).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
