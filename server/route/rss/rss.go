package rss

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	"github.com/yourselfhosted/gomark"
	"github.com/yourselfhosted/gomark/ast"
	"github.com/yourselfhosted/gomark/renderer"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

const (
	maxRSSItemCount       = 100
	maxRSSItemTitleLength = 128
)

type RSSService struct {
	Profile *profile.Profile
	Store   *store.Store
}

func NewRSSService(profile *profile.Profile, store *store.Store) *RSSService {
	return &RSSService{
		Profile: profile,
		Store:   store,
	}
}

func (s *RSSService) RegisterRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", s.GetExploreRSS)
	g.GET("/u/:username/rss.xml", s.GetUserRSS)
}

func (s *RSSService) GetExploreRSS(c echo.Context) error {
	ctx := c.Request().Context()
	normalStatus := store.Normal
	memoFind := store.FindMemo{
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) GetUserRSS(c echo.Context) error {
	ctx := c.Request().Context()
	username := c.Param("username")
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	normalStatus := store.Normal
	memoFind := store.FindMemo{
		CreatorID:      &user.ID,
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) generateRSSFromMemoList(ctx context.Context, memoList []*store.Memo, baseURL string) (string, error) {
	feed := &feeds.Feed{
		Title:       "Memos",
		Link:        &feeds.Link{Href: baseURL},
		Description: "An open source, lightweight note-taking service. Easily capture and share your great thoughts.",
		Created:     time.Now(),
	}

	var itemCountLimit = util.Min(len(memoList), maxRSSItemCount)
	feed.Items = make([]*feeds.Item, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]
		description, err := getRSSItemDescription(memo.Content)
		if err != nil {
			return "", err
		}
		feed.Items[i] = &feeds.Item{
			Title:       getRSSItemTitle(memo.Content),
			Link:        &feeds.Link{Href: baseURL + "/m/" + memo.ResourceName},
			Description: description,
			Created:     time.Unix(memo.CreatedTs, 0),
		}
		resources, err := s.Store.ListResources(ctx, &store.FindResource{
			MemoID: &memo.ID,
		})
		if err != nil {
			return "", err
		}
		if len(resources) > 0 {
			resource := resources[0]
			enclosure := feeds.Enclosure{}
			if resource.ExternalLink != "" {
				enclosure.Url = resource.ExternalLink
			} else {
				enclosure.Url = baseURL + "/o/r/" + resource.ResourceName
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

func getRSSItemTitle(content string) string {
	nodes, _ := gomark.Parse(content)
	if len(nodes) > 0 {
		firstNode := nodes[0]
		title := renderer.NewStringRenderer().Render([]ast.Node{firstNode})
		return title
	}

	title := strings.Split(content, "\n")[0]
	var titleLengthLimit = util.Min(len(title), maxRSSItemTitleLength)
	if titleLengthLimit < len(title) {
		title = title[:titleLengthLimit] + "..."
	}
	return title
}

func getRSSItemDescription(content string) (string, error) {
	nodes, err := gomark.Parse(content)
	if err != nil {
		return "", err
	}
	result := renderer.NewHTMLRenderer().Render(nodes)
	return result, nil
}
