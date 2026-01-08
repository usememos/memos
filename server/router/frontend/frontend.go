package frontend

import (
	"context"
	"embed"
	"errors"
	"io/fs"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/internal/profile"
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

func (*FrontendService) Serve(_ context.Context, e *echo.Echo) error {
	fs, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		return err
	}

	idx, err := parseFSTemplate(fs, "index.html")
	if err != nil {
		return err
	}

	htmlMeta := map[string]string{
		"viewport": "width=device-width, initial-scale=1, user-scalable=no",
	}
	static := echo.StaticDirectoryHandler(fs, false)
	index := templateHandler(idx, templateConfig{
		MetaData: htmlMeta,
	})
	exploreFeedTitle := func(_ echo.Context) string {
		return "Public Memos"
	}
	userFeedTitle := func(c echo.Context) string {
		u := c.Param("username")

		return u + " Memos"
	}
	assets := func(c echo.Context) error {
		p := c.Request().URL.Path
		if p == "/" || p == "/index.html" {
			// do not serve index.html from the filesystem
			// but serve it as rendered template instead
			return index(c)
		}

		// Set Cache-Control header for static assets.
		// Since Vite generates content-hashed filenames (e.g., index-BtVjejZf.js),
		// we can cache aggressively but use immutable to prevent revalidation checks.
		// For frequently redeployed instances, use shorter max-age (1 hour) to avoid
		// serving stale assets after redeployment.
		c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=3600, immutable") // 1 hour
		if err := static(c); err == nil || !errors.Is(err, echo.ErrNotFound) {
			return err
		}

		// fallback to the index document, assuming it is a SPA route
		return index(c)
	}
	e.GET("/", index)
	e.GET("/*", assets)
	e.GET("/explore", templateHandler(idx, templateConfig{
		MetaData:         htmlMeta,
		InjectFeedURL:    true,
		ResolveFeedTitle: exploreFeedTitle,
	}))
	e.GET("/u/:username", templateHandler(idx, templateConfig{
		MetaData:         htmlMeta,
		InjectFeedURL:    true,
		ResolveFeedTitle: userFeedTitle,
	}))

	return nil
}
