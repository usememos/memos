package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

type MemoResource struct {
	MemoID     int32 `json:"memoId"`
	ResourceID int32 `json:"resourceId"`
	CreatedTs  int64 `json:"createdTs"`
	UpdatedTs  int64 `json:"updatedTs"`
}

type UpsertMemoResourceRequest struct {
	ResourceID int32  `json:"resourceId"`
	UpdatedTs  *int64 `json:"updatedTs"`
}

type MemoResourceFind struct {
	MemoID     *int32
	ResourceID *int32
}

type MemoResourceDelete struct {
	MemoID     *int32
	ResourceID *int32
}

func (s *APIV1Service) registerMemoResourceRoutes(g *echo.Group) {
	g.GET("/memo/:memoId/resource", s.GetMemoResourceList)
	g.POST("/memo/:memoId/resource", s.BindMemoResource)
	g.DELETE("/memo/:memoId/resource/:resourceId", s.UnbindMemoResource)
}

// GetMemoResourceList godoc
//
//	@Summary	Get resource list of a memo
//	@Tags		memo-resource
//	@Accept		json
//	@Produce	json
//	@Param		memoId	path		int			true	"ID of memo to fetch resource list from"
//	@Success	200		{object}	[]Resource	"Memo resource list"
//	@Failure	400		{object}	nil			"ID is not a number: %s"
//	@Failure	500		{object}	nil			"Failed to fetch resource list"
//	@Router		/api/v1/memo/{memoId}/resource [GET]
func (s *APIV1Service) GetMemoResourceList(c echo.Context) error {
	ctx := c.Request().Context()
	memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
	}

	list, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &memoID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
	}
	resourceList := []*Resource{}
	for _, resource := range list {
		resourceList = append(resourceList, convertResourceFromStore(resource))
	}
	return c.JSON(http.StatusOK, resourceList)
}

// BindMemoResource godoc
//
//	@Summary	Bind resource to memo
//	@Tags		memo-resource
//	@Accept		json
//	@Produce	json
//	@Param		memoId	path		int							true	"ID of memo to bind resource to"
//	@Param		body	body		UpsertMemoResourceRequest	true	"Memo resource request object"
//	@Success	200		{boolean}	true						"Memo resource binded"
//	@Failure	400		{object}	nil							"ID is not a number: %s | Malformatted post memo resource request | Resource not found"
//	@Failure	401		{object}	nil							"Missing user in session | Unauthorized to bind this resource"
//	@Failure	500		{object}	nil							"Failed to fetch resource | Failed to upsert memo resource"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/memo/{memoId}/resource [POST]
//
// NOTES:
// - Passing 0 to updatedTs will set it to 0 in the database, which is probably unwanted.
func (s *APIV1Service) BindMemoResource(c echo.Context) error {
	ctx := c.Request().Context()
	memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
	}

	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}
	request := &UpsertMemoResourceRequest{}
	if err := json.NewDecoder(c.Request().Body).Decode(request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo resource request").SetInternal(err)
	}
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID: &request.ResourceID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource").SetInternal(err)
	}
	if resource == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Resource not found").SetInternal(err)
	} else if resource.CreatorID != userID {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized to bind this resource").SetInternal(err)
	}

	upsert := &store.UpsertMemoResource{
		MemoID:     memoID,
		ResourceID: request.ResourceID,
		CreatedTs:  time.Now().Unix(),
	}
	if request.UpdatedTs != nil {
		upsert.UpdatedTs = request.UpdatedTs
	}
	if _, err := s.Store.UpsertMemoResource(ctx, upsert); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
	}
	return c.JSON(http.StatusOK, true)
}

// UnbindMemoResource godoc
//
//	@Summary	Unbind resource from memo
//	@Tags		memo-resource
//	@Accept		json
//	@Produce	json
//	@Param		memoId		path		int		true	"ID of memo to unbind resource from"
//	@Param		resourceId	path		int		true	"ID of resource to unbind from memo"
//	@Success	200			{boolean}	true	"Memo resource unbinded. *200 is returned even if the reference doesn't exists "
//	@Failure	400			{object}	nil		"Memo ID is not a number: %s | Resource ID is not a number: %s | Memo not found"
//	@Failure	401			{object}	nil		"Missing user in session | Unauthorized"
//	@Failure	500			{object}	nil		"Failed to find memo | Failed to fetch resource list"
//	@Security	ApiKeyAuth
//	@Router		/api/v1/memo/{memoId}/resource/{resourceId} [DELETE]
func (s *APIV1Service) UnbindMemoResource(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
	}
	memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
	}
	resourceID, err := util.ConvertStringToInt32(c.Param("resourceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Resource ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &memoID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
	}
	if memo == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Memo not found")
	}
	if memo.CreatorID != userID {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	if err := s.Store.DeleteMemoResource(ctx, &store.DeleteMemoResource{
		MemoID:     &memoID,
		ResourceID: &resourceID,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
	}
	return c.JSON(http.StatusOK, true)
}
