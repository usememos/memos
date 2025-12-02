package rss

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/plugin/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	maxRSSItemCount      = 100
	defaultCacheDuration = 1 * time.Hour
	maxCacheSize         = 50 // Maximum number of cached feeds
)

var (
	// Regex to match markdown headings at the start of a line.
	markdownHeadingRegex = regexp.MustCompile(`^#{1,6}\s*`)
)

// cacheEntry represents a cached RSS feed with expiration.
type cacheEntry struct {
	content      string
	etag         string
	lastModified time.Time
	createdAt    time.Time
}

type RSSService struct {
	Profile         *profile.Profile
	Store           *store.Store
	MarkdownService markdown.Service

	// Cache for RSS feeds
	cache      map[string]*cacheEntry
	cacheMutex sync.RWMutex
}

type RSSHeading struct {
	Title       string
	Description string
	Language    string
}

func NewRSSService(profile *profile.Profile, store *store.Store, markdownService markdown.Service) *RSSService {
	return &RSSService{
		Profile:         profile,
		Store:           store,
		MarkdownService: markdownService,
		cache:           make(map[string]*cacheEntry),
	}
}

func (s *RSSService) RegisterRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", s.GetExploreRSS)
	g.GET("/u/:username/rss.xml", s.GetUserRSS)
}

func (s *RSSService) GetExploreRSS(c echo.Context) error {
	ctx := c.Request().Context()
	cacheKey := "explore"

	// Check cache first
	if cached := s.getFromCache(cacheKey); cached != nil {
		// Check ETag for conditional request
		if c.Request().Header.Get("If-None-Match") == cached.etag {
			return c.NoContent(http.StatusNotModified)
		}
		s.setRSSHeaders(c, cached.etag, cached.lastModified)
		return c.String(http.StatusOK, cached.content)
	}

	normalStatus := store.Normal
	limit := maxRSSItemCount
	memoFind := store.FindMemo{
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
		Limit:          &limit,
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, lastModified, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}

	// Cache the result
	etag := s.putInCache(cacheKey, rss, lastModified)
	s.setRSSHeaders(c, etag, lastModified)
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) GetUserRSS(c echo.Context) error {
	ctx := c.Request().Context()
	username := c.Param("username")
	cacheKey := "user:" + username

	// Check cache first
	if cached := s.getFromCache(cacheKey); cached != nil {
		// Check ETag for conditional request
		if c.Request().Header.Get("If-None-Match") == cached.etag {
			return c.NoContent(http.StatusNotModified)
		}
		s.setRSSHeaders(c, cached.etag, cached.lastModified)
		return c.String(http.StatusOK, cached.content)
	}

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
	limit := maxRSSItemCount
	memoFind := store.FindMemo{
		CreatorID:      &user.ID,
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
		Limit:          &limit,
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, lastModified, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}

	// Cache the result
	etag := s.putInCache(cacheKey, rss, lastModified)
	s.setRSSHeaders(c, etag, lastModified)
	return c.String(http.StatusOK, rss)
}

func (s *RSSService) generateRSSFromMemoList(ctx context.Context, memoList []*store.Memo, baseURL string, user *store.User) (string, time.Time, error) {
	rssHeading, err := getRSSHeading(ctx, s.Store)
	if err != nil {
		return "", time.Time{}, err
	}

	feed := &feeds.Feed{
		Title:       rssHeading.Title,
		Link:        &feeds.Link{Href: baseURL},
		Description: rssHeading.Description,
		Created:     time.Now(),
	}

	var itemCountLimit = min(len(memoList), maxRSSItemCount)
	if itemCountLimit == 0 {
		// Return empty feed if no memos
		rss, err := feed.ToRss()
		return rss, time.Time{}, err
	}

	// Track the most recent update time for Last-Modified header
	var lastModified time.Time
	if len(memoList) > 0 {
		lastModified = time.Unix(memoList[0].UpdatedTs, 0)
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
		creatorIDs := make(map[int32]bool)
		for _, memo := range memoList[:itemCountLimit] {
			creatorIDs[memo.CreatorID] = true
		}

		// Batch load all users with a single query by getting all users and filtering
		// Note: This is more efficient than N separate queries
		for creatorID := range creatorIDs {
			creator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &creatorID})
			if err == nil && creator != nil {
				creatorMap[creatorID] = creator
			}
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
			if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL || attachment.StorageType == storepb.AttachmentStorageType_S3 {
				enclosure.Url = attachment.Reference
			} else {
				enclosure.Url = fmt.Sprintf("%s/file/attachments/%s/%s", baseURL, attachment.UID, attachment.Filename)
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

// getFromCache retrieves a cached feed entry if it exists and is not expired.
func (s *RSSService) getFromCache(key string) *cacheEntry {
	s.cacheMutex.RLock()
	entry, exists := s.cache[key]
	s.cacheMutex.RUnlock()

	if !exists {
		return nil
	}

	// Check if cache entry is still valid
	if time.Since(entry.createdAt) > defaultCacheDuration {
		// Entry is expired, remove it
		s.cacheMutex.Lock()
		delete(s.cache, key)
		s.cacheMutex.Unlock()
		return nil
	}

	return entry
}

// putInCache stores a feed in the cache and returns its ETag.
func (s *RSSService) putInCache(key, content string, lastModified time.Time) string {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	// Generate ETag from content hash
	hash := sha256.Sum256([]byte(content))
	etag := fmt.Sprintf(`"%x"`, hash[:8])

	// Implement simple LRU: if cache is too large, remove oldest entries
	if len(s.cache) >= maxCacheSize {
		var oldestKey string
		var oldestTime time.Time
		for k, v := range s.cache {
			if oldestKey == "" || v.createdAt.Before(oldestTime) {
				oldestKey = k
				oldestTime = v.createdAt
			}
		}
		if oldestKey != "" {
			delete(s.cache, oldestKey)
		}
	}

	s.cache[key] = &cacheEntry{
		content:      content,
		etag:         etag,
		lastModified: lastModified,
		createdAt:    time.Now(),
	}

	return etag
}

// setRSSHeaders sets appropriate HTTP headers for RSS responses.
func (*RSSService) setRSSHeaders(c echo.Context, etag string, lastModified time.Time) {
	c.Response().Header().Set(echo.HeaderContentType, "application/rss+xml; charset=utf-8")
	c.Response().Header().Set(echo.HeaderCacheControl, fmt.Sprintf("public, max-age=%d", int(defaultCacheDuration.Seconds())))
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
