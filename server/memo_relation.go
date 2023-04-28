package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/store"
)

func (s *Server) registerMemoRelationRoutes(g *echo.Group) {
	g.POST("/memo/relation", func(c echo.Context) error {
		ctx := c.Request().Context()

		memoRelationCreate := &api.MemoRelationCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(memoRelationCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo relation request").SetInternal(err)
		}

		if memoRelationCreate.Type != api.MemoRelationReference && memoRelationCreate.Type != api.MemoRelationAdditional {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Invalid Relation Type: %s", memoRelationCreate.Type))
		}

		message, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
			MemoID:        memoRelationCreate.MemoID,
			RelatedMemoID: memoRelationCreate.RelationMemoID,
			Type:          api.MemoRelationType(memoRelationCreate.Type),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Create Relation Fail: %v %v", memoRelationCreate.MemoID, memoRelationCreate.RelationMemoID)).SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(message))
	})

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

	g.DELETE("/memo/relation/:memoId/:relatedMemoId/:type", func(c echo.Context) error {
		ctx := c.Request().Context()

		relationType := api.MemoRelationType(c.Param("type"))
		relationDelete := &store.DeleteMemoRelationMessage{
			Type: &relationType,
		}

		if memoID, err := strconv.Atoi(c.Param("memoId")); err == nil {
			relationDelete.MemoID = &memoID
		} else {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}
		if relatedMemoID, err := strconv.Atoi(c.Param("relatedMemoId")); err == nil {
			relationDelete.RelatedMemoID = &relatedMemoID
		} else {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Relation memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		if relationType != api.MemoRelationReference && relationType != api.MemoRelationAdditional {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Invalid Relation Type: %s", relationType))
		}

		err := s.Store.DeleteMemoRelation(ctx, relationDelete)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Delete Relation Fail: %s", c.Param("memoId"))).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})

	g.DELETE("/memo/relation", func(c echo.Context) error {
		ctx := c.Request().Context()
		if err := s.Store.DeleteNullMemoRelation(ctx); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Delete Null Relation Fail").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
