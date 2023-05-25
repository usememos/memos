package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoRelationRoutes(g *echo.Group) {
	g.POST("/memo/:memoId/relation", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoRelationUpsert := &api.MemoRelationUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(memoRelationUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo relation request").SetInternal(err)
		}

		memoRelation, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
			MemoID:        memoID,
			RelatedMemoID: memoRelationUpsert.RelatedMemoID,
			Type:          store.MemoRelationType(memoRelationUpsert.Type),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoRelation))
	})

	g.GET("/memo/:memoId/relation", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoRelationList, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelationMessage{
			MemoID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to list memo relations").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoRelationList))
	})

	g.DELETE("/memo/:memoId/relation/:relatedMemoId/type/:relationType", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}
		relatedMemoID, err := strconv.Atoi(c.Param("relatedMemoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Related memo ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}
		relationType := store.MemoRelationType(c.Param("relationType"))

		if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelationMessage{
			MemoID:        &memoID,
			RelatedMemoID: &relatedMemoID,
			Type:          &relationType,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo relation").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func convertMemoRelationMessageToMemoRelation(memoRelation *store.MemoRelationMessage) *api.MemoRelation {
	return &api.MemoRelation{
		MemoID:        memoRelation.MemoID,
		RelatedMemoID: memoRelation.RelatedMemoID,
		Type:          api.MemoRelationType(memoRelation.Type),
	}
}
