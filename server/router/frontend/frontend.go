package frontend

import (
	"context"
	"embed"
	"encoding/xml"
	"io/fs"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/store"
)

//go:embed dist/*
var embeddedFiles embed.FS

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
	skipper := func(c *echo.Context) bool {
		// Skip API routes.
		if util.HasPrefixes(c.Path(), "/api", "/memos.api.v1", "/robots.txt", "/sitemap.xml") {
			return true
		}
		// For index.html and root path, set no-cache headers to prevent browser caching
		// This prevents sensitive data from being accessible via browser back button after logout
		if c.Path() == "/" || c.Path() == "/index.html" {
			c.Response().Header().Set(echo.HeaderCacheControl, "no-cache, no-store, must-revalidate")
			c.Response().Header().Set("Pragma", "no-cache")
			c.Response().Header().Set("Expires", "0")
			return false
		}
		// Set Cache-Control header for static assets.
		// Since Vite generates content-hashed filenames (e.g., index-BtVjejZf.js),
		// we can cache aggressively but use immutable to prevent revalidation checks.
		// For frequently redeployed instances, use shorter max-age (1 hour) to avoid
		// serving stale assets after redeployment.
		c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=3600, immutable") // 1 hour
		return false
	}

	// Route to serve the main app with HTML5 fallback for SPA behavior.
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: getFileSystem("dist"),
		HTML5:      true, // Enable fallback to index.html
		Skipper:    skipper,
	}))

	s.registerRoutes(e)
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
			Loc: instanceURL + "/m/" + memo.UID,
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
