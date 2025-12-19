package frontend

import (
	"io/fs"
	"net/http"
	"text/template"

	echo "github.com/labstack/echo/v4"
)

var templateFuncs = template.FuncMap{
	"default": templateFuncDefault,
}

type templateData struct {
	FeedURL   string
	FeedTitle string
	Title     string
	MetaData  map[string]string
}

type templateConfig struct {
	InjectFeedURL    bool
	ResolveFeedTitle func(c echo.Context) string
	MetaData         map[string]string
}

func templateHandler(tpl *template.Template, cfg templateConfig) echo.HandlerFunc {
	return func(c echo.Context) error {
		data := &templateData{
			Title:    "Memos",
			MetaData: cfg.MetaData,
		}

		if cfg.InjectFeedURL {
			if cfg.ResolveFeedTitle != nil {
				data.FeedTitle = cfg.ResolveFeedTitle(c)
			}

			data.FeedURL = c.Request().URL.JoinPath("rss.xml").String()
		}

		header := c.Response().Header()
		if header.Get(echo.HeaderContentType) == "" {
			header.Set(echo.HeaderContentType, echo.MIMETextHTMLCharsetUTF8)
		}

		// Prevent sensitive data from being accessible via browser back button after logout
		header.Set(echo.HeaderCacheControl, "no-cache, no-store, must-revalidate")
		header.Set("Pragma", "no-cache")
		header.Set("Expires", "0")

		if err := tpl.Execute(c.Response().Writer, data); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "unable to render template").SetInternal(err)
		}

		return nil
	}
}

func parseFSTemplate(root fs.FS, file string) (*template.Template, error) {
	return template.New(file).Funcs(templateFuncs).ParseFS(root, file)
}

func templateFuncDefault(fallback, value string) string {
	if value != "" {
		return value
	}

	return fallback
}
