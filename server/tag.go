package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerTagRoutes(g *echo.Group) {
	g.POST("/tag", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		tagUpsert := &api.TagUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(tagUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post tag request").SetInternal(err)
		}
		if tagUpsert.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Tag name shouldn't be empty")
		}

		tagUpsert.CreatorID = userID
		tag, err := s.Store.UpsertTag(ctx, tagUpsert)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert tag").SetInternal(err)
		}
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "tag created",
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(tag.Name)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode tag response").SetInternal(err)
		}
		return nil
	})

	g.GET("/tag", func(c echo.Context) error {
		ctx := c.Request().Context()
		tagFind := &api.TagFind{}
		if userID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			tagFind.CreatorID = userID
		}

		if tagFind.CreatorID == 0 {
			currentUserID, ok := c.Get(getUserIDContextKey()).(int)
			if !ok {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find tag")
			}
			tagFind.CreatorID = currentUserID
		}

		tagList, err := s.Store.FindTagList(ctx, tagFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find tag list").SetInternal(err)
		}

		tagNameList := []string{}
		for _, tag := range tagList {
			tagNameList = append(tagNameList, tag.Name)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(tagNameList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode tags response").SetInternal(err)
		}
		return nil
	})

	g.GET("/tag/suggestion", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user session")
		}
		contentSearch := "#"
		normalRowStatus := api.Normal
		memoFind := api.MemoFind{
			CreatorID:     &userID,
			ContentSearch: &contentSearch,
			RowStatus:     &normalRowStatus,
		}

		memoList, err := s.Store.FindMemoList(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		tagMapSet := make(map[string]bool)
		for _, memo := range memoList {
			for _, tag := range findTagListFromMemoContent(memo.Content) {
				tagMapSet[tag] = true
			}
		}
		tagList := []string{}
		for tag := range tagMapSet {
			tagList = append(tagList, tag)
		}
		sort.Strings(tagList)

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(tagList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode tags response").SetInternal(err)
		}
		return nil
	})

	g.DELETE("/tag/:tagName", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		tagName := c.Param("tagName")
		if tagName == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Tag name cannot be empty")
		}

		tagDelete := &api.TagDelete{
			Name:      tagName,
			CreatorID: userID,
		}
		if err := s.Store.DeleteTag(ctx, tagDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Tag name not found: %s", tagName))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete tag name: %v", tagName)).SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})
}

var tagRegexp = regexp.MustCompile(`#([^\s#]+)`)

func findTagListFromMemoContent(memoContent string) []string {
	tagMapSet := make(map[string]bool)
	matches := tagRegexp.FindAllStringSubmatch(memoContent, -1)
	for _, v := range matches {
		tagName := v[1]
		tagMapSet[tagName] = true
	}

	tagList := []string{}
	for tag := range tagMapSet {
		tagList = append(tagList, tag)
	}
	sort.Strings(tagList)
	return tagList
}
