package server

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
)

func (s *Server) registerRSSRoutes(g *echo.Group) {
	g.GET("/u/:id/rss.xml", func(c echo.Context) error {
		ctx := c.Request().Context()

		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "User id is not a number").SetInternal(err)
		}

		normalStatus := api.Normal
		memoFind := api.MemoFind{
			CreatorID: &id,
			RowStatus: &normalStatus,
			VisibilityList: []api.Visibility{
				api.Public,
			},
		}
		memoList, err := s.Store.FindMemoList(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		userFind := api.UserFind{
			ID: &id,
		}
		user, err := s.Store.FindUser(ctx, &userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
		}

		baseURL := c.Scheme() + "://" + c.Request().Host

		feed := &feeds.Feed{
			Title:       "Memos",
			Link:        &feeds.Link{Href: baseURL},
			Description: "Memos",
			Author:      &feeds.Author{Name: user.Username},
			Created:     time.Now(),
		}

		feed.Items = make([]*feeds.Item, len(memoList))
		for i, memo := range memoList {
			feed.Items[i] = &feeds.Item{
				Title:       user.Username + "-memos-" + strconv.Itoa(memo.ID),
				Link:        &feeds.Link{Href: baseURL + "/m/" + strconv.Itoa(memo.ID)},
				Description: memo.Content,
				Created:     time.Unix(memo.CreatedTs, 0),
			}
		}

		rss, err := feed.ToRss()
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
		}

		rssPrefix := `<?xml version="1.0" encoding="UTF-8"?>`

		return c.XMLBlob(http.StatusOK, []byte(rss[len(rssPrefix):]))
	})
}
