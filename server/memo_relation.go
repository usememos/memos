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

		memoID := memoRelationCreate.MemoID
		relatedMemoID := memoRelationCreate.RelationMemoID
		relationType := memoRelationCreate.Type

		// if err != nil || err2 != nil {
		// 	return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		// }
		fmt.Println(memoID)
		fmt.Println(relatedMemoID)
		fmt.Println(relationType)
		if relationType != api.MemoRelationReference && relationType != api.MemoRelationAdditional {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Invalid Relation Type: %s", relationType))
		}

		message, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
			MemoID:        memoID,
			RelatedMemoID: relatedMemoID,
			Type:          api.MemoRelationType(relationType),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Create Relation Fail: %v %v", memoID, relatedMemoID)).SetInternal(err)
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

	g.DELETE("/memo/relation/:memoId/:relatedMemoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		relationDelete := &store.DeleteMemoRelationMessage{}

		if memoID, err := strconv.Atoi(c.Param("memoId")); err == nil {
			relationDelete.MemoID = &memoID
		}
		if relatedMemoID, err := strconv.Atoi(c.Param("relatedMemoId")); err == nil {
			relationDelete.RelatedMemoID = &relatedMemoID
		}
		err := s.Store.DeleteMemoRelation(ctx, relationDelete)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Delete Relation Fail: %s", c.Param("memoId"))).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
