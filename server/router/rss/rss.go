package rss

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/internal/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	maxRSSItemCount = 100
)

var (
	// Regex to match markdown headings at the start of a line.
	markdownHeadingRegex = regexp.MustCompile(`^#{1,6}\s*`)
)

type RSSService struct {
	Store           *store.Store
	MarkdownService markdown.Service
}

type RSSHeading struct {
	Title       string
	Description string
	Language    string
}

// NewRSSService creates an RSS service backed by the store and markdown renderer.
func NewRSSService(store *store.Store, markdownService markdown.Service) *RSSService {
	return &RSSService{
		Store:           store,
		MarkdownService: markdownService,
	}
}

func (s *RSSService) RegisterRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", s.GetExploreRSS)
	g.GET("/u/:username/rss.xml", s.GetUserRSS)
}

func (s *RSSService) GetExploreRSS(c *echo.Context) error {
	ctx := c.Request().Context()
	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get instance access policy").Wrap(err)
	}
	if !allowAnonymous {
		return echo.NewHTTPError(http.StatusNotFound, "RSS is unavailable")
	}

	normalStatus := store.Normal
	limit := maxRSSItemCount
	memoFind := store.FindMemo{
		RowStatus:       &normalStatus,
		VisibilityList:  []store.Visibility{store.Public},
		Access:          &store.MemoAccessScope{AllowPublic: true},
		ExcludeComments: true,
		Limit:           &limit,
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").Wrap(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, lastModified, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").Wrap(err)
	}

	etag := rssETag(rss)
	s.setRSSHeaders(c, etag, lastModified)
	if c.Request().Header.Get("If-None-Match") == etag {
		return c.NoContent(http.StatusNotModified)
	}
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) GetUserRSS(c *echo.Context) error {
	ctx := c.Request().Context()
	allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get instance access policy").Wrap(err)
	}
	if !allowAnonymous {
		return echo.NewHTTPError(http.StatusNotFound, "RSS is unavailable")
	}

	username := c.Param("username")
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").Wrap(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	normalStatus := store.Normal
	limit := maxRSSItemCount
	memoFind := store.FindMemo{
		CreatorID:       &user.ID,
		RowStatus:       &normalStatus,
		VisibilityList:  []store.Visibility{store.Public},
		Access:          &store.MemoAccessScope{AllowPublic: true},
		ExcludeComments: true,
		Limit:           &limit,
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").Wrap(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, lastModified, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").Wrap(err)
	}

	etag := rssETag(rss)
	s.setRSSHeaders(c, etag, lastModified)
	if c.Request().Header.Get("If-None-Match") == etag {
		return c.NoContent(http.StatusNotModified)
	}
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) generateRSSFromMemoList(ctx context.Context, memoList []*store.Memo, baseURL string, user *store.User) (string, time.Time, error) {
	rssHeading, err := getRSSHeading(ctx, s.Store)
	if err != nil {
		return "", time.Time{}, err
	}

	itemCountLimit := min(len(memoList), maxRSSItemCount)
	// Derive channel timestamps only from feed data. Using the request time here
	// changes an otherwise identical body and defeats ETag revalidation.
	var lastModified time.Time
	for _, memo := range memoList[:itemCountLimit] {
		if updated := time.Unix(memo.UpdatedTs, 0); updated.After(lastModified) {
			lastModified = updated
		}
	}
	feed := &feeds.Feed{
		Title:       rssHeading.Title,
		Link:        &feeds.Link{Href: baseURL},
		Description: rssHeading.Description,
		Created:     lastModified,
		Updated:     lastModified,
	}

	if itemCountLimit == 0 {
		// Return empty feed if no memos
		rss, err := feed.ToRss()
		return rss, time.Time{}, err
	}

	// Batch load all attachments for all memos to avoid N+1 query problem
	memoIDs := make([]int32, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memoIDs[i] = memoList[i].ID
	}

	allAttachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoIDList: memoIDs,
	})
	if err != nil {
		return "", lastModified, err
	}

	// Group attachments by memo ID for quick lookup
	attachmentsByMemoID := make(map[int32][]*store.Attachment)
	for _, attachment := range allAttachments {
		if attachment.MemoID != nil {
			attachmentsByMemoID[*attachment.MemoID] = append(attachmentsByMemoID[*attachment.MemoID], attachment)
		}
	}

	// Batch load all memo creators
	creatorMap := make(map[int32]*store.User)
	if user != nil {
		// Single user feed - reuse the user object
		creatorMap[user.ID] = user
	} else {
		// Multi-user feed - batch load all unique creators
		creatorIDList := []int32{}
		creatorIDMap := make(map[int32]bool)
		for _, memo := range memoList[:itemCountLimit] {
			if !creatorIDMap[memo.CreatorID] {
				creatorIDList = append(creatorIDList, memo.CreatorID)
				creatorIDMap[memo.CreatorID] = true
			}
		}

		// Batch load all users with a single query
		users, err := s.Store.ListUsers(ctx, &store.FindUser{
			IDList: creatorIDList,
		})
		if err != nil {
			return "", lastModified, err
		}
		for _, creator := range users {
			creatorMap[creator.ID] = creator
		}
	}

	// Generate feed items
	feed.Items = make([]*feeds.Item, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]

		// Generate item title from memo content
		title := s.generateItemTitle(memo.Content)

		// Render content as HTML
		htmlContent, err := s.getRSSItemDescription(memo.Content)
		if err != nil {
			return "", lastModified, err
		}

		link := &feeds.Link{Href: baseURL + "/memos/" + memo.UID}

		item := &feeds.Item{
			Title:       title,
			Link:        link,
			Description: htmlContent, // Summary/excerpt
			Content:     htmlContent, // Full content in content:encoded
			Created:     time.Unix(memo.CreatedTs, 0),
			Updated:     time.Unix(memo.UpdatedTs, 0),
			Id:          link.Href,
		}

		// Add author information
		if creator, ok := creatorMap[memo.CreatorID]; ok {
			authorName := creator.Nickname
			if authorName == "" {
				authorName = creator.Username
			}
			item.Author = &feeds.Author{
				Name:  authorName,
				Email: creator.Email,
			}
		}

		// Note: gorilla/feeds doesn't support categories in RSS items
		// Tags could be added to the description or content if needed

		// Add first attachment as enclosure
		if attachments, ok := attachmentsByMemoID[memo.ID]; ok && len(attachments) > 0 {
			attachment := attachments[0]
			enclosure := feeds.Enclosure{}
			if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
				enclosure.Url = attachment.Reference
			} else {
				enclosure.Url = fmt.Sprintf("%s/file/attachments/%s", baseURL, attachment.UID)
			}
			enclosure.Length = strconv.Itoa(int(attachment.Size))
			enclosure.Type = attachment.Type
			item.Enclosure = &enclosure
		}

		feed.Items[i] = item
	}

	rss, err := feed.ToRss()
	if err != nil {
		return "", lastModified, err
	}
	return rss, lastModified, nil
}

func (*RSSService) generateItemTitle(content string) string {
	// Extract first line as title
	lines := strings.Split(content, "\n")
	title := strings.TrimSpace(lines[0])

	// Remove markdown heading syntax using regex (handles # to ###### with optional spaces)
	title = markdownHeadingRegex.ReplaceAllString(title, "")
	title = strings.TrimSpace(title)

	// Limit title length
	const maxTitleLength = 100
	if len(title) > maxTitleLength {
		// Find last space before limit to avoid cutting words
		cutoff := maxTitleLength
		for i := min(maxTitleLength-1, len(title)-1); i > 0; i-- {
			if title[i] == ' ' {
				cutoff = i
				break
			}
		}
		if cutoff < maxTitleLength {
			title = title[:cutoff] + "..."
		} else {
			// No space found, just truncate
			title = title[:maxTitleLength] + "..."
		}
	}

	// If title is empty, use a default
	if title == "" {
		title = "Memo"
	}

	return title
}

func (s *RSSService) getRSSItemDescription(content string) (string, error) {
	html, err := s.MarkdownService.RenderHTML([]byte(content))
	if err != nil {
		return "", err
	}
	return html, nil
}

func rssETag(content string) string {
	hash := sha256.Sum256([]byte(content))
	return fmt.Sprintf(`"%x"`, hash[:8])
}

// setRSSHeaders sets appropriate HTTP headers for RSS responses.
func (*RSSService) setRSSHeaders(c *echo.Context, etag string, lastModified time.Time) {
	c.Response().Header().Set(echo.HeaderContentType, "application/rss+xml; charset=utf-8")
	// Revalidation is mandatory because an audience change must not leave a
	// previously PUBLIC memo readable from a stale feed body.
	c.Response().Header().Set(echo.HeaderCacheControl, "public, no-cache")
	c.Response().Header().Set("ETag", etag)
	if !lastModified.IsZero() {
		c.Response().Header().Set("Last-Modified", lastModified.UTC().Format(http.TimeFormat))
	}
}

func getRSSHeading(ctx context.Context, stores *store.Store) (RSSHeading, error) {
	settings, err := stores.GetInstanceGeneralSetting(ctx)
	if err != nil {
		return RSSHeading{}, err
	}
	if settings == nil || settings.CustomProfile == nil {
		return RSSHeading{
			Title:       "Memos",
			Description: "An open source, lightweight note-taking service. Easily capture and share your great thoughts.",
			Language:    "en-us",
		}, nil
	}
	customProfile := settings.CustomProfile

	return RSSHeading{
		Title:       customProfile.Title,
		Description: customProfile.Description,
		Language:    "en-us",
	}, nil
}
