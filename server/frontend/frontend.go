package frontend

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	v1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

//go:embed dist
var embeddedFiles embed.FS

//go:embed dist/index.html
var rawIndexHTML string

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

func (s *FrontendService) Serve(e *echo.Echo) {
	// Use echo static middleware to serve the built dist folder
	// refer: https://github.com/labstack/echo/blob/master/middleware/static.go
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper:    defaultAPIRequestSkipper,
		HTML5:      true,
		Filesystem: getFileSystem("dist"),
	}))

	assetsGroup := e.Group("assets")
	assetsGroup.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Skipper: defaultAPIRequestSkipper,
		Level:   5,
	}))
	assetsGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
			return next(c)
		}
	})
	assetsGroup.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Skipper:    defaultAPIRequestSkipper,
		HTML5:      true,
		Filesystem: getFileSystem("dist/assets"),
	}))

	s.registerRoutes(e)
}

func (s *FrontendService) registerRoutes(e *echo.Echo) {
	e.GET("/robots.txt", func(c echo.Context) error {
		ctx := c.Request().Context()
		instanceURLSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: v1.SystemSettingInstanceURLName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get instance URL system setting").SetInternal(err)
		}
		if instanceURLSetting == nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Instance URL system setting is not set")
		}
		instanceURL := instanceURLSetting.Value
		robotsTxt := fmt.Sprintf(`User-agent: *
Allow: /
Host: %s
Sitemap: %s/sitemap.xml`, instanceURL, instanceURL)
		return c.String(http.StatusOK, robotsTxt)
	})

	e.GET("/sitemap.xml", func(c echo.Context) error {
		ctx := c.Request().Context()
		instanceURLSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: v1.SystemSettingInstanceURLName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get instance URL system setting").SetInternal(err)
		}
		if instanceURLSetting == nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Instance URL system setting is not set")
		}

		instanceURL := instanceURLSetting.Value
		urlsets := []string{}
		// Append memo list.
		memoList, err := s.Store.ListMemos(ctx, &store.FindMemo{
			VisibilityList: []store.Visibility{store.Public},
		})
		if err != nil {
			return err
		}
		for _, memo := range memoList {
			urlsets = append(urlsets, fmt.Sprintf(`<url><loc>%s</loc></url>`, fmt.Sprintf("%s/m/%d", instanceURL, memo.ID)))
		}
		// Append user list.
		userList, err := s.Store.ListUsers(ctx, &store.FindUser{})
		if err != nil {
			return err
		}
		for _, user := range userList {
			urlsets = append(urlsets, fmt.Sprintf(`<url><loc>%s</loc></url>`, fmt.Sprintf("%s/u/%s", instanceURL, user.Username)))
		}

		sitemap := fmt.Sprintf(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">%s</urlset>`, strings.Join(urlsets, "\n"))
		return c.XMLBlob(http.StatusOK, []byte(sitemap))
	})

	e.GET("/m/:memoID", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoID"))
		if err != nil {
			// Redirect to `index.html` if any error occurs.
			return c.HTML(http.StatusOK, rawIndexHTML)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
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
		indexHTML := strings.ReplaceAll(rawIndexHTML, "<!-- memos.metadata -->", generateMemoMetadata(memo, creator))
		return c.HTML(http.StatusOK, indexHTML)
	})
}

func generateMemoMetadata(memo *store.Memo, creator *store.User) string {
	description := memo.Content
	if memo.Visibility == store.Private {
		description = "This memo is private."
	} else if memo.Visibility == store.Protected {
		description = "This memo is protected."
	}
	metadataList := []string{
		fmt.Sprintf(`<meta name="description" content="%s" />`, description),
		fmt.Sprintf(`<meta property="og:title" content="%s" />`, fmt.Sprintf("%s(@%s) on Memos", creator.Nickname, creator.Username)),
		fmt.Sprintf(`<meta property="og:description" content="%s" />`, description),
		fmt.Sprintf(`<meta property="og:image" content="%s" />`, "https://www.usememos.com/logo.png"),
		`<meta property="og:type" content="website" />`,
		// Twitter related metadata.
		fmt.Sprintf(`<meta name="twitter:title" content="%s" />`, fmt.Sprintf("%s(@%s) on Memos", creator.Nickname, creator.Username)),
		fmt.Sprintf(`<meta name="twitter:description" content="%s" />`, description),
		fmt.Sprintf(`<meta name="twitter:image" content="%s" />`, "https://www.usememos.com/logo.png"),
		`<meta name="twitter:card" content="summary" />`,
	}
	return strings.Join(metadataList, "\n")
}

func getFileSystem(path string) http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}
	return http.FS(fs)
}

func defaultAPIRequestSkipper(c echo.Context) bool {
	path := c.Request().URL.Path
	return util.HasPrefixes(path, "/api", "/memos.api.v2")
}
