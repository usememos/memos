package frontend

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

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
	e.GET("/m/:memoID", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoID"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid memo id")
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to retrieve memo")
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, "memo not found")
		}
		if memo.Visibility != store.Public {
			return echo.NewHTTPError(http.StatusForbidden, "memo is not public")
		}
		indexHTML := strings.ReplaceAll(rawIndexHTML, "<!-- memos.metadata -->", generateMemoMetadata(memo))
		return c.HTML(http.StatusOK, indexHTML)
	})
}

func generateMemoMetadata(memo *store.Memo) string {
	metadataList := []string{
		fmt.Sprintf(`<meta name="description" content="%s" />`, memo.Content),
		fmt.Sprintf(`<meta property="og:title" content="%s" />`, fmt.Sprintf("Memos - %d", memo.ID)),
		fmt.Sprintf(`<meta property="og:description" content="%s" />`, memo.Content),
		fmt.Sprintf(`<meta property="og:image" content="%s" />`, "https://www.usememos.com/logo.png"),
		`<meta property="og:type" content="website" />`,
		// Twitter related metadata.
		fmt.Sprintf(`<meta name="twitter:title" content="%s" />`, fmt.Sprintf("Memos - %d", memo.ID)),
		fmt.Sprintf(`<meta name="twitter:description" content="%s" />`, memo.Content),
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
