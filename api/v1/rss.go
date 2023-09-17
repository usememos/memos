package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/feeds"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/yuin/goldmark"

	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

const maxRSSItemCount = 100
const maxRSSItemTitleLength = 100

func (s *APIV1Service) registerRSSRoutes(g *echo.Group) {
	g.GET("/explore/rss.xml", s.GetExploreRSS)
	g.GET("/u/:id/rss.xml", s.GetUserRSS)
}

// GetExploreRSS godoc
//
//	@Summary	Get RSS
//	@Tags		rss
//	@Produce	xml
//	@Success	200	{object}	nil	"RSS"
//	@Failure	500	{object}	nil	"Failed to get system customized profile | Failed to find memo list | Failed to generate rss"
//	@Router		/explore/rss.xml [GET]
func (s *APIV1Service) GetExploreRSS(c echo.Context) error {
	ctx := c.Request().Context()
	systemCustomizedProfile, err := s.getSystemCustomizedProfile(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
	}

	normalStatus := store.Normal
	memoFind := store.FindMemo{
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, systemCustomizedProfile)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
	return c.String(http.StatusOK, rss)
}

// GetUserRSS godoc
//
//	@Summary	Get RSS for a user
//	@Tags		rss
//	@Produce	xml
//	@Param		id	path		int	true	"User ID"
//	@Success	200	{object}	nil	"RSS"
//	@Failure	400	{object}	nil	"User id is not a number"
//	@Failure	500	{object}	nil	"Failed to get system customized profile | Failed to find memo list | Failed to generate rss"
//	@Router		/u/{id}/rss.xml [GET]
func (s *APIV1Service) GetUserRSS(c echo.Context) error {
	ctx := c.Request().Context()
	id, err := util.ConvertStringToInt32(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "User id is not a number").SetInternal(err)
	}

	systemCustomizedProfile, err := s.getSystemCustomizedProfile(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get system customized profile").SetInternal(err)
	}

	normalStatus := store.Normal
	memoFind := store.FindMemo{
		CreatorID:      &id,
		RowStatus:      &normalStatus,
		VisibilityList: []store.Visibility{store.Public},
	}
	memoList, err := s.Store.ListMemos(ctx, &memoFind)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
	}

	baseURL := c.Scheme() + "://" + c.Request().Host
	rss, err := s.generateRSSFromMemoList(ctx, memoList, baseURL, systemCustomizedProfile)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate rss").SetInternal(err)
	}
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationXMLCharsetUTF8)
	return c.String(http.StatusOK, rss)
}

func (s *APIV1Service) generateRSSFromMemoList(ctx context.Context, memoList []*store.Memo, baseURL string, profile *CustomizedProfile) (string, error) {
	feed := &feeds.Feed{
		Title:       profile.Name,
		Link:        &feeds.Link{Href: baseURL},
		Description: profile.Description,
		Created:     time.Now(),
	}

	var itemCountLimit = util.Min(len(memoList), maxRSSItemCount)
	feed.Items = make([]*feeds.Item, itemCountLimit)
	for i := 0; i < itemCountLimit; i++ {
		memo := memoList[i]
		feed.Items[i] = &feeds.Item{
			Title:       getRSSItemTitle(memo.Content),
			Link:        &feeds.Link{Href: baseURL + "/m/" + fmt.Sprintf("%d", memo.ID)},
			Description: getRSSItemDescription(memo.Content),
			Created:     time.Unix(memo.CreatedTs, 0),
			Enclosure:   &feeds.Enclosure{Url: baseURL + "/m/" + fmt.Sprintf("%d", memo.ID) + "/image"},
		}
		if len(memo.ResourceIDList) > 0 {
			resourceID := memo.ResourceIDList[0]
			resource, err := s.Store.GetResource(ctx, &store.FindResource{
				ID: &resourceID,
			})
			if err != nil {
				return "", err
			}
			if resource == nil {
				return "", errors.Errorf("Resource not found: %d", resourceID)
			}
			enclosure := feeds.Enclosure{}
			if resource.ExternalLink != "" {
				enclosure.Url = resource.ExternalLink
			} else {
				enclosure.Url = baseURL + "/o/r/" + fmt.Sprintf("%d", resource.ID)
			}
			enclosure.Length = strconv.Itoa(int(resource.Size))
			enclosure.Type = resource.Type
			feed.Items[i].Enclosure = &enclosure
		}
	}

	rss, err := feed.ToRss()
	if err != nil {
		return "", err
	}
	return rss, nil
}

func (s *APIV1Service) getSystemCustomizedProfile(ctx context.Context) (*CustomizedProfile, error) {
	systemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: SystemSettingCustomizedProfileName.String(),
	})
	if err != nil {
		return nil, err
	}
	customizedProfile := &CustomizedProfile{
		Name:        "memos",
		LogoURL:     "",
		Description: "",
		Locale:      "en",
		Appearance:  "system",
		ExternalURL: "",
	}
	if systemSetting != nil {
		if err := json.Unmarshal([]byte(systemSetting.Value), customizedProfile); err != nil {
			return nil, err
		}
	}
	return customizedProfile, nil
}

func getRSSItemTitle(content string) string {
	var title string
	if isTitleDefined(content) {
		title = strings.Split(content, "\n")[0][2:]
	} else {
		title = strings.Split(content, "\n")[0]
		var titleLengthLimit = util.Min(len(title), maxRSSItemTitleLength)
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

	// TODO: use our `./plugin/gomark` parser to handle markdown-like content.
	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(description), &buf); err != nil {
		panic(err)
	}
	return buf.String()
}

func isTitleDefined(content string) bool {
	return strings.HasPrefix(content, "# ")
}
