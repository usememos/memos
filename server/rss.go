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

const MaxRSSItemCount = 100
const MaxRSSItemTitleLength = 100

func generateRSSFromMemoList(memoList []*api.Memo, baseURL string, profile *api.CustomizedProfile) (string, error) {
	feed := &feeds.Feed{
		Title:       profile.Name,
		Link:        &feeds.Link{Href: baseURL},
		Description: profile.Description,
		Created:     time.Now(),
	}

	var itemCountLimit = min(len(memoList), MaxRSSItemCount)

	feed.Items = make([]*feeds.Item, itemCountLimit)

	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]

		feed.Items[i] = &feeds.Item{
			Title:       getRSSItemTitle(memo.Content),
			Link:        &feeds.Link{Href: baseURL + "/m/" + strconv.Itoa(memo.ID)},
			Description: getRSSItemDescription(memo.Content),
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

		var value any
		err := json.Unmarshal([]byte(systemSetting.Value), &value)
		if err != nil {
			return api.CustomizedProfile{}, err
		}

		if systemSetting.Name == api.SystemSettingCustomizedProfileName {
			valueMap := value.(map[string]any)
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func getRSSItemTitle(content string) string {
	var title string
	if isTitleDefined(content) {
		title = strings.Split(content, "\n")[0][2:]
	} else {
		title = strings.Split(content, "\n")[0]
		var titleLengthLimit = min(len(title), MaxRSSItemTitleLength)
		if titleLengthLimit < len(title) {
			title = title[:titleLengthLimit] + "..."
		}
	}
	return title
}

func getRSSItemDescription(content string) string {
	var description string
	if isTitleDefined(content) {
		var firstLineEnd = strings.Index(content, "\n")
		description = strings.Trim(content[firstLineEnd+1:], " ")
	} else {
		description = content
	}
	return description
}

func isTitleDefined(content string) bool {
	return strings.HasPrefix(content, "# ")
}
