package rss

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	"github.com/usememos/gomark"
	"github.com/usememos/gomark/renderer"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	maxRSSItemCount = 100
)

type RSSService struct {
	Profile *profile.Profile
	Store   *store.Store
}

type RSSHeading struct {
	Title       string
	Description string
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
	rssHeading, err := getRSSHeading(ctx, s.Store)
	if err != nil {
		return "", err
	}
	feed := &feeds.Feed{
		Title:       rssHeading.Title,
		Link:        &feeds.Link{Href: baseURL},
		Description: rssHeading.Description,
		Created:     time.Now(),
	}

	var itemCountLimit = min(len(memoList), maxRSSItemCount)
	feed.Items = make([]*feeds.Item, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]
		description, err := getRSSItemDescription(memo.Content)
		if err != nil {
			return "", err
		}
		link := &feeds.Link{Href: baseURL + "/memos/" + memo.UID}
		feed.Items[i] = &feeds.Item{
			Link:        link,
			Description: description,
			Created:     time.Unix(memo.CreatedTs, 0),
			Id:          link.Href,
		}
		attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
			MemoID: &memo.ID,
		})
		if err != nil {
			return "", err
		}
		if len(attachments) > 0 {
			attachment := attachments[0]
			enclosure := feeds.Enclosure{}
			if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL || attachment.StorageType == storepb.AttachmentStorageType_S3 {
				enclosure.Url = attachment.Reference
			} else {
				enclosure.Url = fmt.Sprintf("%s/file/attachments/%s/%s", baseURL, attachment.UID, attachment.Filename)
			}
			enclosure.Length = strconv.Itoa(int(attachment.Size))
			enclosure.Type = attachment.Type
			feed.Items[i].Enclosure = &enclosure
		}
	}

	rss, err := feed.ToRss()
	if err != nil {
		return "", err
	}
	return rss, nil
}

func getRSSItemDescription(content string) (string, error) {
	nodes, err := gomark.Parse(content)
	if err != nil {
		return "", err
	}
	result := renderer.NewHTMLRenderer().Render(nodes)
	return result, nil
}

func getRSSHeading(ctx context.Context, stores *store.Store) (RSSHeading, error) {
	settings, err := stores.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return RSSHeading{}, err
	}
	if settings == nil || settings.CustomProfile == nil {
		return RSSHeading{
			Title:       "Memos",
			Description: "An open source, lightweight note-taking service. Easily capture and share your great thoughts.",
		}, nil
	}
	customProfile := settings.CustomProfile
	return RSSHeading{
		Title:       customProfile.Title,
		Description: customProfile.Description,
	}, nil
}
