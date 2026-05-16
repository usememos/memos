package frontend

import (
	"context"
	"embed"
	"encoding/xml"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
)

//go:embed dist/*
var embeddedFiles embed.FS

const (
	frontendHTMLCacheControl        = "no-cache, no-store, must-revalidate"
	frontendStaticAssetCacheControl = "public, max-age=3600"
	frontendHashedAssetCacheControl = "public, max-age=3600, immutable"
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

func (s *FrontendService) Serve(_ context.Context, e *echo.Echo) {
	frontendFS := getFileSystem("dist")
	skipper := func(c *echo.Context) bool {
		requestPath := c.Request().URL.Path
		if shouldSkipFrontendStatic(requestPath) {
			return true
		}

		setFrontendCacheHeaders(c, requestPath)
		return false
	}

	// Route to serve the frontend static assets.
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: frontendFS,
		Skipper:    skipper,
	}))

	e.Use(spaFallbackMiddleware(frontendFS))
	s.registerRoutes(e)
}

func spaFallbackMiddleware(frontendFS fs.FS) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			err := next(c)
			if err == nil {
				return nil
			}

			requestPath := c.Request().URL.Path
			if shouldSkipFrontendStatic(requestPath) || !shouldServeFrontendHTML(requestPath) || echo.StatusCode(err) != http.StatusNotFound {
				return err
			}

			setFrontendCacheHeaders(c, requestPath)
			return c.FileFS("index.html", frontendFS)
		}
	}
}

func shouldSkipFrontendStatic(requestPath string) bool {
	if requestPath == "/robots.txt" || requestPath == "/sitemap.xml" || strings.HasSuffix(requestPath, "/rss.xml") {
		return true
	}
	return hasPathPrefix(requestPath, "/api") ||
		hasPathPrefix(requestPath, "/file") ||
		hasPathPrefix(requestPath, "/mcp") ||
		requestPath == "/memos.api.v1" ||
		strings.HasPrefix(requestPath, "/memos.api.v1.")
}

func setFrontendCacheHeaders(c *echo.Context, requestPath string) {
	if shouldServeFrontendHTML(requestPath) {
		c.Response().Header().Set(echo.HeaderCacheControl, frontendHTMLCacheControl)
		c.Response().Header().Set("Pragma", "no-cache")
		c.Response().Header().Set("Expires", "0")
		return
	}

	cacheControl := frontendStaticAssetCacheControl
	if strings.HasPrefix(requestPath, "/assets/") {
		cacheControl = frontendHashedAssetCacheControl
	}
	c.Response().Header().Set(echo.HeaderCacheControl, cacheControl)
}

func shouldServeFrontendHTML(requestPath string) bool {
	return requestPath == "/" || requestPath == "/index.html" || path.Ext(requestPath) == ""
}

func hasPathPrefix(requestPath, prefix string) bool {
	return requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/")
}

func getFileSystem(path string) fs.FS {
	sub, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}
	return sub
}

func (s *FrontendService) registerRoutes(e *echo.Echo) {
	e.GET("/robots.txt", s.getRobotsTXT)
	e.GET("/sitemap.xml", s.getSitemapXML)
}

func (s *FrontendService) getRobotsTXT(c *echo.Context) error {
	instanceURL, err := normalizeInstanceURL(s.Profile.InstanceURL)
	if err != nil {
		return err
	}

	robotsTXT := strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"Host: " + instanceURL,
		"Sitemap: " + instanceURL + "/sitemap.xml",
	}, "\n")
	return c.String(http.StatusOK, robotsTXT)
}

func (s *FrontendService) getSitemapXML(c *echo.Context) error {
	instanceURL, err := normalizeInstanceURL(s.Profile.InstanceURL)
	if err != nil {
		return err
	}

	memos, err := s.Store.ListMemos(c.Request().Context(), &store.FindMemo{
		VisibilityList: []store.Visibility{store.Public},
	})
	if err != nil {
		return errors.Wrap(err, "failed to list public memos for sitemap")
	}

	urls := make([]sitemapURL, 0, len(memos))
	for _, memo := range memos {
		urls = append(urls, sitemapURL{
			Loc: instanceURL + "/memos/" + memo.UID,
		})
	}

	return c.XML(http.StatusOK, sitemapURLSet{
		XMLNS: sitemapXMLNamespace,
		URLs:  urls,
	})
}

func normalizeInstanceURL(instanceURL string) (string, error) {
	instanceURL = strings.TrimRight(instanceURL, "/")
	if instanceURL == "" {
		return "", echo.NewHTTPError(http.StatusNotFound, "instance URL is not configured")
	}
	return instanceURL, nil
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc string `xml:"loc"`
}

//nolint:revive
const sitemapXMLNamespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
