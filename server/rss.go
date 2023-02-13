package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
)

func (s *Server) registerRSSRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", func(c echo.Context) error {
		ctx := c.Request().Context()

		systemCustomizedProfile, err := getSystemCustomizedProfile(ctx, s)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
		}

		normalStatus := api.Normal
		memoFind := api.MemoFind{
			RowStatus: &normalStatus,
			VisibilityList: []api.Visibility{
				api.Public,
			},
		}
		memoList, err := s.Store.FindMemoList(ctx, &memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		baseURL := c.Scheme() + "://" + c.Request().Host
		rss, err := generateRSSFromMemoList(memoList, baseURL, &systemCustomizedProfile)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
		return c.String(http.StatusOK, rss)
	})

	g.GET("/u/:id/rss.xml", func(c echo.Context) error {
		ctx := c.Request().Context()

		systemCustomizedProfile, err := getSystemCustomizedProfile(ctx, s)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
		}

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

		baseURL := c.Scheme() + "://" + c.Request().Host

		rss, err := generateRSSFromMemoList(memoList, baseURL, &systemCustomizedProfile)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
		}
		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
		return c.String(http.StatusOK, rss)
	})
}

func generateRSSFromMemoList(memoList []*api.Memo, baseURL string, profile *api.CustomizedProfile) (string, error) {
	feed := &feeds.Feed{
		Title:       profile.Name,
		Link:        &feeds.Link{Href: baseURL},
		Description: profile.Description,
		Created:     time.Now(),
	}

	feed.Items = make([]*feeds.Item, len(memoList))
	for i, memo := range memoList {
		var useTitle = strings.HasPrefix(memo.Content, "# ")

		var title string
		if useTitle {
			title = strings.Split(memo.Content, "\n")[0][2:]
		} else {
			title = memo.Creator.Username + "-memos-" + strconv.Itoa(memo.ID)
		}

		var description string
		if useTitle {
			var firstLineEnd = strings.Index(memo.Content, "\n")
			description = memo.Content[firstLineEnd+1:]
		} else {
			description = memo.Content
		}

		feed.Items[i] = &feeds.Item{
			Title:       title,
			Link:        &feeds.Link{Href: baseURL + "/m/" + strconv.Itoa(memo.ID)},
			Description: description,
			Created:     time.Unix(memo.CreatedTs, 0),
		}
	}

	rss, err := feed.ToRss()
	if err != nil {
		return "", err
	}
	return rss, nil
}

func getSystemCustomizedProfile(ctx context.Context, s *Server) (api.CustomizedProfile, error) {
	systemStatus := api.SystemStatus{
		CustomizedProfile: api.CustomizedProfile{
			Name:        "memos",
			LogoURL:     "",
			Description: "",
			Locale:      "en",
			Appearance:  "system",
			ExternalURL: "",
		},
	}

	systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
	if err != nil {
		return api.CustomizedProfile{}, err
	}
	for _, systemSetting := range systemSettingList {
		if systemSetting.Name == api.SystemSettingServerID || systemSetting.Name == api.SystemSettingSecretSessionName {
			continue
		}

		var value interface{}
		err := json.Unmarshal([]byte(systemSetting.Value), &value)
		if err != nil {
			return api.CustomizedProfile{}, err
		}

		if systemSetting.Name == api.SystemSettingCustomizedProfileName {
			valueMap := value.(map[string]interface{})
			systemStatus.CustomizedProfile = api.CustomizedProfile{}
			if v := valueMap["name"]; v != nil {
				systemStatus.CustomizedProfile.Name = v.(string)
			}
			if v := valueMap["logoUrl"]; v != nil {
				systemStatus.CustomizedProfile.LogoURL = v.(string)
			}
			if v := valueMap["description"]; v != nil {
				systemStatus.CustomizedProfile.Description = v.(string)
			}
			if v := valueMap["locale"]; v != nil {
				systemStatus.CustomizedProfile.Locale = v.(string)
			}
			if v := valueMap["appearance"]; v != nil {
				systemStatus.CustomizedProfile.Appearance = v.(string)
			}
			if v := valueMap["externalUrl"]; v != nil {
				systemStatus.CustomizedProfile.ExternalURL = v.(string)
			}
		}
	}
	return systemStatus.CustomizedProfile, nil
}
