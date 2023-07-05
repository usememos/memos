package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
	"github.com/yuin/goldmark"
)

func (s *Server) registerRSSRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", func(c echo.Context) error {
		ctx := c.Request().Context()
		systemCustomizedProfile, err := s.getSystemCustomizedProfile(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
		}

		normalStatus := store.Normal
		memoFind := store.FindMemoMessage{
			RowStatus:      &normalStatus,
			VisibilityList: []store.Visibility{store.Public},
		}
		memoList, err := s.Store.ListMemos(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		baseURL := c.Scheme() + "://" + c.Request().Host
		rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, systemCustomizedProfile)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
		}
		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
		return c.String(http.StatusOK, rss)
	})

	g.GET("/u/:id/rss.xml", func(c echo.Context) error {
		ctx := c.Request().Context()
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "User id is not a number").SetInternal(err)
		}

		systemCustomizedProfile, err := s.getSystemCustomizedProfile(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
		}

		normalStatus := store.Normal
		memoFind := store.FindMemoMessage{
			CreatorID:      &id,
			RowStatus:      &normalStatus,
			VisibilityList: []store.Visibility{store.Public},
		}
		memoList, err := s.Store.ListMemos(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		baseURL := c.Scheme() + "://" + c.Request().Host
		rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, systemCustomizedProfile)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
		}
		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
		return c.String(http.StatusOK, rss)
	})
}

const MaxRSSItemCount = 100
const MaxRSSItemTitleLength = 100

func (s *Server) generateRSSFromMemoList(ctx context.Context, memoList []*store.MemoMessage, baseURL string, profile *apiv1.CustomizedProfile) (string, error) {
	feed := &feeds.Feed{
		Title:       profile.Name,
		Link:        &feeds.Link{Href: baseURL},
		Description: profile.Description,
		Created:     time.Now(),
	}

	var itemCountLimit = common.Min(len(memoList), MaxRSSItemCount)
	feed.Items = make([]*feeds.Item, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]
		feed.Items[i] = &feeds.Item{
			Title:       getRSSItemTitle(memo.Content),
			Link:        &feeds.Link{Href: baseURL + "/m/" + strconv.Itoa(memo.ID)},
			Description: getRSSItemDescription(memo.Content),
			Created:     time.Unix(memo.CreatedTs, 0),
			Enclosure:   &feeds.Enclosure{Url: baseURL + "/m/" + strconv.Itoa(memo.ID) + "/image"},
		}
		if len(memo.ResourceIDList) > 0 {
			resourceID := memo.ResourceIDList[0]
			resource, err := s.Store.GetResource(ctx, &store.FindResource{
				ID: &resourceID,
			})
			if err != nil {
				return "", err
			}
			enclosure := feeds.Enclosure{}
			if resource.ExternalLink != "" {
				enclosure.Url = resource.ExternalLink
			} else {
				enclosure.Url = baseURL + "/o/r/" + strconv.Itoa(resource.ID) + "/" + resource.PublicID + "/" + resource.Filename
			}
			enclosure.Length = strconv.Itoa(int(resource.Size))
			enclosure.Type = resource.Type
			feed.Items[i].Enclosure = &enclosure
		}
	}

	rss, err := feed.ToRss()
	if err != nil {
		return "", err
	}
	return rss, nil
}

func (s *Server) getSystemCustomizedProfile(ctx context.Context) (*apiv1.CustomizedProfile, error) {
	systemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingCustomizedProfileName.String(),
	})
	if err != nil {
		return nil, err
	}
	customizedProfile := &apiv1.CustomizedProfile{
		Name:        "memos",
		LogoURL:     "",
		Description: "",
		Locale:      "en",
		Appearance:  "system",
		ExternalURL: "",
	}
	if systemSetting != nil {
		if err := json.Unmarshal([]byte(systemSetting.Value), customizedProfile); err != nil {
			return nil, err
		}
	}
	return customizedProfile, nil
}

func getRSSItemTitle(content string) string {
	var title string
	if isTitleDefined(content) {
		title = strings.Split(content, "\n")[0][2:]
	} else {
		title = strings.Split(content, "\n")[0]
		var titleLengthLimit = common.Min(len(title), MaxRSSItemTitleLength)
		if titleLengthLimit < len(title) {
			title = title[:titleLengthLimit] + "..."
		}
	}
	return title
}

func getRSSItemDescription(content string) string {
	var description string
	if isTitleDefined(content) {
		var firstLineEnd = strings.Index(content, "\n")
		description = strings.Trim(content[firstLineEnd+1:], " ")
	} else {
		description = content
	}

	// TODO: use our `./plugin/gomark` parser to handle markdown-like content.
	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(description), &buf); err != nil {
		panic(err)
	}
	return buf.String()
}

func isTitleDefined(content string) bool {
	return strings.HasPrefix(content, "# ")
}
