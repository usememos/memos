package server

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

//go:embed dist
var embeddedFiles embed.FS

func getFileSystem(path string) http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, path)
	if err != nil {
		panic(err)
	}

	return http.FS(fs)
}

func embedFrontend(e *echo.Echo) {
	// Use echo static middleware to serve the built dist folder
	// refer: https://github.com/labstack/echo/blob/master/middleware/static.go
	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		HTML5:      true,
		Filesystem: getFileSystem("dist"),
	}))

	g := e.Group("assets")
	g.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
			return next(c)
		}
	})
	g.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		HTML5:      true,
		Filesystem: getFileSystem("dist/assets"),
	}))
}
