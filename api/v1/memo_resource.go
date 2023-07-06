package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/store"
)

type MemoResource struct {
	MemoID     int   `json:"memoId"`
	ResourceID int   `json:"resourceId"`
	CreatedTs  int64 `json:"createdTs"`
	UpdatedTs  int64 `json:"updatedTs"`
}

type UpsertMemoResourceRequest struct {
	ResourceID int    `json:"resourceId"`
	UpdatedTs  *int64 `json:"updatedTs"`
}

type MemoResourceFind struct {
	MemoID     *int
	ResourceID *int
}

type MemoResourceDelete struct {
	MemoID     *int
	ResourceID *int
}

func (s *APIV1Service) registerMemoResourceRoutes(g *echo.Group) {
	g.POST("/memo/:memoId/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
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
	})

	g.GET("/memo/:memoId/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
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
	})

	g.DELETE("/memo/:memoId/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Resource ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
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
	})
}
