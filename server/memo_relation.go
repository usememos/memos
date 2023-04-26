package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoRelationRoutes(g *echo.Group) {
	g.GET("/memo/relation/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		// memoIDList, err := s.Store.FindRelationMemos(ctx, memoID)
		return c.JSON(http.StatusOK, composeResponse(memoIDList))
	})

	g.GET("/memo/backrelation/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		// memoIDList, err := s.Store.FindBackRelationMemos(ctx, memoID)
		return c.JSON(http.StatusOK, composeResponse(memoIDList))
	})

	g.POST("/memo/relation/:memoId/:memoId2/:type", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		memoID2, err2 := strconv.Atoi(c.Param("memoId2"))
		type_ := c.Param("type")

		if err != nil || err2 != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		// err = s.Store.CreateMemoRelation(ctx, memoID, memoID2, type_)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Create Fail: %s", c.Param("memoId"))).SetInternal(err)
		}

		// check type_ is valid

		return c.JSON(http.StatusOK, composeResponse("success"))
	})

}
