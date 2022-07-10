package server

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/labstack/echo/v4"
)

//go:embed dist
var embeddedFiles embed.FS

//go:embed dist/index.html
var indexContent string

func getFileSystem() http.FileSystem {
	fs, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		panic(err)
	}

	return http.FS(fs)
}

func embedFrontend(e *echo.Echo) {
	// Catch-all route to return index.html, this is to prevent 404 when accessing non-root url.
	// See https://stackoverflow.com/questions/27928372/react-router-urls-dont-work-when-refreshing-or-writing-manually
	e.GET("/*", func(c echo.Context) error {
		return c.HTML(http.StatusOK, indexContent)
	})

	assetHandler := http.FileServer(getFileSystem())
	e.GET("/assets/*", echo.WrapHandler(assetHandler))
	e.GET("/icons/*", echo.WrapHandler(assetHandler))
	e.GET("/favicon.svg", echo.WrapHandler(assetHandler))
}
