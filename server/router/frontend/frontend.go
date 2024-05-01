package frontend

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/yourselfhosted/gomark/parser"
	"github.com/yourselfhosted/gomark/parser/tokenizer"
	"github.com/yourselfhosted/gomark/renderer"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

//go:embed dist
var embeddedFiles embed.FS

const (
	// maxMetadataDescriptionLength is the maximum length of metadata description.
	maxMetadataDescriptionLength = 256
)

type FrontendService struct {
	Profile *profile.Profile
	Store   *store.Store
}

func NewFrontendService(profile *profile.Profile, store *store.Store) *FrontendService {
	return &FrontendService{
		Profile: profile,
		Store:   store,
	}
}

func (s *FrontendService) Serve(ctx context.Context, e *echo.Echo) {
	skipper := func(c echo.Context) bool {
		return util.HasPrefixes(c.Path(), "/o", "/api", "/memos.api.v1", "/robots.txt", "/sitemap.xml", "/m/:name")
	}

	// Use echo static middleware to serve the built dist folder.
	// Reference: https://github.com/labstack/echo/blob/master/middleware/static.go
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		HTML5:      true,
		Filesystem: getFileSystem("dist"),
		Skipper:    skipper,
	}))
	g := e.Group("assets")
	// Use echo gzip middleware to compress the response.
	// Reference: https://echo.labstack.com/docs/middleware/gzip
	g.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	g.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
			return next(c)
		}
	})
	g.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: getFileSystem("dist/assets"),
	}))

	s.registerRoutes(e)
	s.registerFileRoutes(ctx, e)
}

func (s *FrontendService) registerRoutes(e *echo.Echo) {
	rawIndexHTML := getRawIndexHTML()

	e.GET("/m/:uid", func(c echo.Context) error {
		ctx := c.Request().Context()
		uid := c.Param("uid")
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			UID: &uid,
		})
		if err != nil {
			return c.HTML(http.StatusOK, rawIndexHTML)
		}
		if memo == nil {
			return c.HTML(http.StatusOK, rawIndexHTML)
		}
		creator, err := s.Store.GetUser(ctx, &store.FindUser{
			ID: &memo.CreatorID,
		})
		if err != nil {
			return c.HTML(http.StatusOK, rawIndexHTML)
		}

		// Inject memo metadata into `index.html`.
		indexHTML := strings.ReplaceAll(rawIndexHTML, "<!-- memos.metadata.head -->", generateMemoMetadata(memo, creator).String())
		indexHTML = strings.ReplaceAll(indexHTML, "<!-- memos.metadata.body -->", fmt.Sprintf("<!-- memos.memo.%d -->", memo.ID))
		return c.HTML(http.StatusOK, indexHTML)
	})
}

func (s *FrontendService) registerFileRoutes(ctx context.Context, e *echo.Echo) {
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return
	}
	instanceURL := workspaceGeneralSetting.GetInstanceUrl()
	if instanceURL == "" {
		return
	}

	e.GET("/robots.txt", func(c echo.Context) error {
		robotsTxt := fmt.Sprintf(`User-agent: *
Allow: /
Host: %s
Sitemap: %s/sitemap.xml`, instanceURL, instanceURL)
		return c.String(http.StatusOK, robotsTxt)
	})

	e.GET("/sitemap.xml", func(c echo.Context) error {
		ctx := c.Request().Context()
		urlsets := []string{}
		// Append memo list.
		memoList, err := s.Store.ListMemos(ctx, &store.FindMemo{
			VisibilityList: []store.Visibility{store.Public},
		})
		if err != nil {
			return err
		}
		for _, memo := range memoList {
			urlsets = append(urlsets, fmt.Sprintf(`<url><loc>%s</loc></url>`, fmt.Sprintf("%s/m/%s", instanceURL, memo.UID)))
		}
		sitemap := fmt.Sprintf(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">%s</urlset>`, strings.Join(urlsets, "\n"))
		return c.XMLBlob(http.StatusOK, []byte(sitemap))
	})
}

func getFileSystem(path string) http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}

	return http.FS(fs)
}

func generateMemoMetadata(memo *store.Memo, creator *store.User) *Metadata {
	metadata := getDefaultMetadata()
	metadata.Title = fmt.Sprintf("%s(@%s) on Memos", creator.Nickname, creator.Username)
	if memo.Visibility == store.Public {
		tokens := tokenizer.Tokenize(memo.Content)
		nodes, _ := parser.Parse(tokens)
		description := renderer.NewStringRenderer().Render(nodes)
		if len(description) == 0 {
			description = memo.Content
		}
		if len(description) > maxMetadataDescriptionLength {
			description = description[:maxMetadataDescriptionLength] + "..."
		}
		metadata.Description = description
	}

	return metadata
}

func getRawIndexHTML() string {
	bytes, _ := embeddedFiles.ReadFile("dist/index.html")
	return string(bytes)
}

type Metadata struct {
	Title       string
	Description string
	ImageURL    string
}

func getDefaultMetadata() *Metadata {
	return &Metadata{
		Title:       "Memos",
		Description: "A privacy-first, lightweight note-taking service. Easily capture and share your great thoughts.",
		ImageURL:    "/logo.webp",
	}
}

func (m *Metadata) String() string {
	metadataList := []string{
		fmt.Sprintf(`<meta name="description" content="%s" />`, m.Description),
		fmt.Sprintf(`<meta property="og:title" content="%s" />`, m.Title),
		fmt.Sprintf(`<meta property="og:description" content="%s" />`, m.Description),
		fmt.Sprintf(`<meta property="og:image" content="%s" />`, m.ImageURL),
		`<meta property="og:type" content="website" />`,
		// Twitter related fields.
		fmt.Sprintf(`<meta property="twitter:title" content="%s" />`, m.Title),
		fmt.Sprintf(`<meta property="twitter:description" content="%s" />`, m.Description),
		fmt.Sprintf(`<meta property="twitter:image" content="%s" />`, m.ImageURL),
		`<meta name="twitter:card" content="summary" />`,
		`<meta name="twitter:creator" content="memos" />`,
	}
	return strings.Join(metadataList, "\n")
}
