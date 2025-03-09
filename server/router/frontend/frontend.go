package frontend

import (
	"context"
	"embed"
	"io/fs"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
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

func (*FrontendService) Serve(_ context.Context, e *echo.Echo) {
	apiSkipper := func(c echo.Context) bool {
		return util.HasPrefixes(c.Path(), "/api", "/memos.api.v1")
	}

	// Route to serve the main app with HTML5 fallback for SPA behavior.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Skip API routes.
			if apiSkipper(c) {
				return next(c)
			}
			// Skip `/index.html`.
			if c.Path() == "/index.html" {
				return next(c)
			}
			c.Response().Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
			return next(c)
		}
	}, middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: getFileSystem("dist"),
		HTML5:      true, // Enable fallback to index.html
		Skipper:    apiSkipper,
	}))
}

func getFileSystem(path string) http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}
	return http.FS(fs)
}
