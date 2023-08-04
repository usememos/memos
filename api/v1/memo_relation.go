package v1

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelation struct {
	MemoID        int32            `json:"memoId"`
	RelatedMemoID int32            `json:"relatedMemoId"`
	Type          MemoRelationType `json:"type"`
}

type UpsertMemoRelationRequest struct {
	RelatedMemoID int32            `json:"relatedMemoId"`
	Type          MemoRelationType `json:"type"`
}

func (s *APIV1Service) registerMemoRelationRoutes(g *echo.Group) {
	g.POST("/memo/:memoId/relation", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		request := &UpsertMemoRelationRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo relation request").SetInternal(err)
		}

		memoRelation, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        memoID,
			RelatedMemoID: request.RelatedMemoID,
			Type:          store.MemoRelationType(request.Type),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoRelation)
	})

	g.GET("/memo/:memoId/relation", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoRelationList, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
			MemoID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to list memo relations").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoRelationList)
	})

	g.DELETE("/memo/:memoId/relation/:relatedMemoId/type/:relationType", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}
		relatedMemoID, err := util.ConvertStringToInt32(c.Param("relatedMemoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Related memo ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}
		relationType := store.MemoRelationType(c.Param("relationType"))

		if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
			MemoID:        &memoID,
			RelatedMemoID: &relatedMemoID,
			Type:          &relationType,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo relation").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func convertMemoRelationFromStore(memoRelation *store.MemoRelation) *MemoRelation {
	return &MemoRelation{
		MemoID:        memoRelation.MemoID,
		RelatedMemoID: memoRelation.RelatedMemoID,
		Type:          MemoRelationType(memoRelation.Type),
	}
}
