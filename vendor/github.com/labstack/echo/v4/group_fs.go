package echo

import (
	"io/fs"
	"net/http"
)

// Static implements `Echo#Static()` for sub-routes within the Group.
func (g *Group) Static(pathPrefix, fsRoot string) {
	subFs := MustSubFS(g.echo.Filesystem, fsRoot)
	g.StaticFS(pathPrefix, subFs)
}

// StaticFS implements `Echo#StaticFS()` for sub-routes within the Group.
//
// When dealing with `embed.FS` use `fs := echo.MustSubFS(fs, "rootDirectory") to create sub fs which uses necessary
// prefix for directory path. This is necessary as `//go:embed assets/images` embeds files with paths
// including `assets/images` as their prefix.
func (g *Group) StaticFS(pathPrefix string, filesystem fs.FS) {
	g.Add(
		http.MethodGet,
		pathPrefix+"*",
		StaticDirectoryHandler(filesystem, false),
	)
}

// FileFS implements `Echo#FileFS()` for sub-routes within the Group.
func (g *Group) FileFS(path, file string, filesystem fs.FS, m ...MiddlewareFunc) *Route {
	return g.GET(path, StaticFileHandler(file, filesystem), m...)
}
