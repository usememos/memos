package server

import (
	"encoding/json"
	"net/http"
	"regexp"
	"sort"
	"strconv"

	"github.com/usememos/memos/api"

	"github.com/labstack/echo/v4"
)

var tagRegexpList = []*regexp.Regexp{regexp.MustCompile(`^#([^\s#]+?) `), regexp.MustCompile(`[^\S#]?#([^\s#]+?) `)}

func (s *Server) registerTagRoutes(g *echo.Group) {
	g.GET("/tag", func(c echo.Context) error {
		ctx := c.Request().Context()
		contentSearch := "#"
		normalRowStatus := api.Normal
		memoFind := api.MemoFind{
			ContentSearch: &contentSearch,
			RowStatus:     &normalRowStatus,
		}

		if userID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			memoFind.CreatorID = &userID
		}

		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			if memoFind.CreatorID == nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
			}
			memoFind.VisibilityList = []api.Visibility{api.Public}
		} else {
			if memoFind.CreatorID == nil {
				memoFind.CreatorID = &currentUserID
			} else {
				memoFind.VisibilityList = []api.Visibility{api.Public, api.Protected}
			}
		}

		memoList, err := s.Store.FindMemoList(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		tagList := []string{}
		for _, memo := range memoList {
			tagList = append(tagList, findTagListFromMemoContent(memo.Content)...)
		}
		sort.Strings(tagList)

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(tagList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode tags response").SetInternal(err)
		}
		return nil
	})
}

func findTagListFromMemoContent(memoContent string) []string {
	tagMapSet := make(map[string]bool)
	for _, tagRegexp := range tagRegexpList {
		for _, rawTag := range tagRegexp.FindAllString(memoContent, -1) {
			tag := tagRegexp.ReplaceAllString(rawTag, "$1")
			tagMapSet[tag] = true
		}
	}

	tagList := []string{}
	for tag := range tagMapSet {
		tagList = append(tagList, tag)
	}
	sort.Strings(tagList)
	return tagList
}
