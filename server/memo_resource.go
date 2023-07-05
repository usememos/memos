package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoResourceRoutes(g *echo.Group) {
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
		memoResourceUpsert := &api.MemoResourceUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(memoResourceUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo resource request").SetInternal(err)
		}
		resource, err := s.Store.GetResource(ctx, &store.FindResource{
			ID: &memoResourceUpsert.ResourceID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource").SetInternal(err)
		}
		if resource == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Resource not found").SetInternal(err)
		} else if resource.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized to bind this resource").SetInternal(err)
		}

		memoResourceUpsert.MemoID = memoID
		currentTs := time.Now().Unix()
		memoResourceUpsert.UpdatedTs = &currentTs
		if _, err := s.Store.UpsertMemoResource(ctx, memoResourceUpsert); err != nil {
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
		resourceList := []*api.Resource{}
		for _, resource := range list {
			resourceList = append(resourceList, convertResourceFromStore(resource))
		}
		return c.JSON(http.StatusOK, composeResponse(resourceList))
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

		memo, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		memoResourceDelete := &api.MemoResourceDelete{
			MemoID:     &memoID,
			ResourceID: &resourceID,
		}
		if err := s.Store.DeleteMemoResource(ctx, memoResourceDelete); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}
