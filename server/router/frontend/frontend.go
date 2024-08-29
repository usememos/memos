package frontend

import (
	"context"
	"embed"
	"io/fs"
	"net/http"

	"io"
	"html/template"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

//go:embed dist
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

var base_url = ""

func indexHander(c echo.Context) error {
	// open index.html
	file, err := embeddedFiles.Open("dist/index.html")
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	defer file.Close()
	// render it.
	b, err := io.ReadAll(file)
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}

	c.Response().WriteHeader(http.StatusOK)
	template.Must(template.New("index.html").Parse(string(b))).Execute(c.Response().Writer, map[string]any{
		"baseurl": base_url,
	})

	return nil
}

func (f *FrontendService) Serve(_ context.Context, e *echo.Echo) {
	skipper := func(c echo.Context) bool {
		path_ := c.Path()
		return path_ == "/" || path_ == "/index.html" || util.HasPrefixes(path_, "/api", "/memos.api.v1")
	}

	e.GET("/", indexHander)
	e.GET("/index.html", indexHander)
	// save base_url from profile.
	base_url = f.Profile.BaseURL

	// Use echo static middleware to serve the built dist folder.
	// Reference: https://github.com/labstack/echo/blob/master/middleware/static.go
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		HTML5:      false,
		Filesystem: getFileSystem("dist"),
		Skipper:    skipper,
	}), func (skipper middleware.Skipper) echo.MiddlewareFunc {
		return func(next echo.HandlerFunc) echo.HandlerFunc {
			return func(c echo.Context) (err error) {
				// skip 
				if skipper(c) {
					return next(c)
				}
				// skip assets
				if (util.HasPrefixes(c.Path(), "/assets")){
					return next(c)
				}
				// otherwise (NotFound), serve index.html
				return indexHander(c)
			}
		}
	}(skipper))
	// Use echo gzip middleware to compress the response.
	// Reference: https://echo.labstack.com/docs/middleware/gzip
	e.Group("assets").Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}), func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
			return next(c)
		}
	}, middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: getFileSystem("dist/assets"),
	}))
}

func getFileSystem(path string) http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}
	return http.FS(fs)
}
