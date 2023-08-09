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
	g.GET("/memo/:memoId/relation", s.getMemoRelationList)
	g.POST("/memo/:memoId/relation", s.createMemoRelation)
	g.DELETE("/memo/:memoId/relation/:relatedMemoId/type/:relationType", s.deleteMemoRelation)
}

// getMemoRelationList godoc
//
//	@Summary	Get a list of Memo Relations
//	@Tags		memo-relation
//	@Accept		json
//	@Produce	json
//	@Param		memoId	path		int						true	"ID of memo to find relations"
//	@Success	200		{object}	[]store.MemoRelation	"Memo relation information list"
//	@Failure	400		{object}	nil						"ID is not a number: %s"
//	@Failure	500		{object}	nil						"Failed to list memo relations"
//	@Router		/api/v1/memo/{memoId}/relation [GET]
func (s *APIV1Service) getMemoRelationList(c echo.Context) error {
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
}

// createMemoRelation godoc
//
//	@Summary		Create Memo Relation
//	@Description	Create a relation between two memos
//	@Tags			memo-relation
//	@Accept			json
//	@Produce		json
//	@Param			memoId	path		int							true	"ID of memo to relate"
//	@Param			body	body		UpsertMemoRelationRequest	true	"Memo relation object"
//	@Success		200		{object}	store.MemoRelation			"Memo relation information"
//	@Failure		400		{object}	nil							"ID is not a number: %s | Malformatted post memo relation request"
//	@Failure		500		{object}	nil							"Failed to upsert memo relation"
//	@Router			/api/v1/memo/{memoId}/relation [POST]
//
// NOTES:
// - Currently not secured
// - It's possible to create relations to memos that doesn't exist, which will trigger 404 errors when the frontend tries to load them.
// - It's possible to create multiple relations, though the interface only shows first.
func (s *APIV1Service) createMemoRelation(c echo.Context) error {
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
}

// deleteMemoRelation godoc
//
//	@Summary		Delete a Memo Relation
//	@Description	Removes a relation between two memos
//	@Tags			memo-relation
//	@Accept			json
//	@Produce		json
//	@Param			memoId			path		int					true	"ID of memo to find relations"
//	@Param			relatedMemoId	path		int					true	"ID of memo to remove relation to"
//	@Param			relationType	path		MemoRelationType	true	"Type of relation to remove"
//	@Success		200				{boolean}	true				"Memo relation deleted"
//	@Failure		400				{object}	nil					"Memo ID is not a number: %s | Related memo ID is not a number: %s"
//	@Failure		500				{object}	nil					"Failed to delete memo relation"
//	@Router			/api/v1/memo/{memoId}/relation/{relatedMemoId}/type/{relationType} [DELETE]
//
// NOTES:
// - Currently not secured.
// - Will always return true, even if the relation doesn't exist.
func (s *APIV1Service) deleteMemoRelation(c echo.Context) error {
	ctx := c.Request().Context()
	memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
	}
	relatedMemoID, err := util.ConvertStringToInt32(c.Param("relatedMemoId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Related memo ID is not a number: %s", c.Param("relatedMemoId"))).SetInternal(err)
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
}

func convertMemoRelationFromStore(memoRelation *store.MemoRelation) *MemoRelation {
	return &MemoRelation{
		MemoID:        memoRelation.MemoID,
		RelatedMemoID: memoRelation.RelatedMemoID,
		Type:          MemoRelationType(memoRelation.Type),
	}
}
