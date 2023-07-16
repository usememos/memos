package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
	"golang.org/x/exp/slices"
)

type Tag struct {
	Name      string
	CreatorID int
}

type UpsertTagRequest struct {
	Name string `json:"name"`
}

type DeleteTagRequest struct {
	Name string `json:"name"`
}

func (s *APIV1Service) registerTagRoutes(g *echo.Group) {
	g.POST("/tag", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		tagUpsert := &UpsertTagRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(tagUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post tag request").SetInternal(err)
		}
		if tagUpsert.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Tag name shouldn't be empty")
		}

		tag, err := s.Store.UpsertTag(ctx, &store.Tag{
			Name:      tagUpsert.Name,
			CreatorID: userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert tag").SetInternal(err)
		}
		tagMessage := convertTagFromStore(tag)
		if err := s.createTagCreateActivity(c, tagMessage); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, tagMessage.Name)
	})

	g.GET("/tag", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find tag")
		}

		list, err := s.Store.ListTags(ctx, &store.FindTag{
			CreatorID: userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find tag list").SetInternal(err)
		}

		tagNameList := []string{}
		for _, tag := range list {
			tagNameList = append(tagNameList, tag.Name)
		}
		return c.JSON(http.StatusOK, tagNameList)
	})

	g.GET("/tag/suggestion", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user session")
		}
		normalRowStatus := store.Normal
		memoFind := &store.FindMemo{
			CreatorID:     &userID,
			ContentSearch: []string{"#"},
			RowStatus:     &normalRowStatus,
		}

		memoMessageList, err := s.Store.ListMemos(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		list, err := s.Store.ListTags(ctx, &store.FindTag{
			CreatorID: userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find tag list").SetInternal(err)
		}
		tagNameList := []string{}
		for _, tag := range list {
			tagNameList = append(tagNameList, tag.Name)
		}

		tagMapSet := make(map[string]bool)
		for _, memo := range memoMessageList {
			for _, tag := range findTagListFromMemoContent(memo.Content) {
				if !slices.Contains(tagNameList, tag) {
					tagMapSet[tag] = true
				}
			}
		}
		tagList := []string{}
		for tag := range tagMapSet {
			tagList = append(tagList, tag)
		}
		sort.Strings(tagList)
		return c.JSON(http.StatusOK, tagList)
	})

	g.POST("/tag/delete", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		tagDelete := &DeleteTagRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(tagDelete); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post tag request").SetInternal(err)
		}
		if tagDelete.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Tag name shouldn't be empty")
		}

		err := s.Store.DeleteTag(ctx, &store.DeleteTag{
			Name:      tagDelete.Name,
			CreatorID: userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete tag name: %v", tagDelete.Name)).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func (s *APIV1Service) createTagCreateActivity(c echo.Context, tag *Tag) error {
	ctx := c.Request().Context()
	payload := ActivityTagCreatePayload{
		TagName: tag.Name,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: tag.CreatorID,
		Type:      ActivityTagCreate.String(),
		Level:     ActivityInfo.String(),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func convertTagFromStore(tag *store.Tag) *Tag {
	return &Tag{
		Name:      tag.Name,
		CreatorID: tag.CreatorID,
	}
}

var tagRegexp = regexp.MustCompile(`#([^\s#,]+)`)

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
