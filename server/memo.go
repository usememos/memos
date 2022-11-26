package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoRoutes(g *echo.Group) {
	g.POST("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memoCreate := &api.MemoCreate{
			CreatorID: userID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request").SetInternal(err)
		}
		if memoCreate.Content == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Memo content shouldn't be empty")
		}

		if memoCreate.Visibility == "" {
			userSettingMemoVisibilityKey := api.UserSettingMemoVisibilityKey
			userMemoVisibilitySetting, err := s.Store.FindUserSetting(ctx, &api.UserSettingFind{
				UserID: userID,
				Key:    &userSettingMemoVisibilityKey,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user setting").SetInternal(err)
			}

			if userMemoVisibilitySetting != nil {
				memoVisibility := api.Private
				err := json.Unmarshal([]byte(userMemoVisibilitySetting.Value), &memoVisibility)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal user setting value").SetInternal(err)
				}
				memoCreate.Visibility = memoVisibility
			} else {
				// Private is the default memo visibility.
				memoCreate.Visibility = api.Private
			}
		}

		memo, err := s.Store.CreateMemo(ctx, memoCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "memo created",
		})

		for _, resourceID := range memoCreate.ResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
				MemoID:     memo.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}

		memo, err = s.Store.ComposeMemo(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.PATCH("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoFind := &api.MemoFind{
			ID:        &memoID,
			CreatorID: &userID,
		}
		if _, err := s.Store.FindMemo(ctx, memoFind); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		memoPatch := &api.MemoPatch{
			ID:        memoID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request").SetInternal(err)
		}

		memo, err := s.Store.PatchMemo(ctx, memoPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch memo").SetInternal(err)
		}

		for _, resourceID := range memoPatch.ResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
				MemoID:     memo.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}

		memo, err = s.Store.ComposeMemo(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoFind := &api.MemoFind{}
		if userID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			memoFind.CreatorID = &userID
		}

		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			if memoFind.CreatorID == nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
			}
			memoFind.VisibilityList = []api.Visibility{api.Public}
		} else {
			if memoFind.CreatorID == nil {
				memoFind.CreatorID = &currentUserID
			} else {
				memoFind.VisibilityList = []api.Visibility{api.Public, api.Protected}
			}
		}

		rowStatus := api.RowStatus(c.QueryParam("rowStatus"))
		if rowStatus != "" {
			memoFind.RowStatus = &rowStatus
		}
		pinnedStr := c.QueryParam("pinned")
		if pinnedStr != "" {
			pinned := pinnedStr == "true"
			memoFind.Pinned = &pinned
		}
		tag := c.QueryParam("tag")
		if tag != "" {
			contentSearch := "#" + tag + " "
			memoFind.ContentSearch = &contentSearch
		}
		visibilityListStr := c.QueryParam("visibility")
		if visibilityListStr != "" {
			visibilityList := []api.Visibility{}
			for _, visibility := range strings.Split(visibilityListStr, ",") {
				visibilityList = append(visibilityList, api.Visibility(visibility))
			}
			memoFind.VisibilityList = visibilityList
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			memoFind.Limit = limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			memoFind.Offset = offset
		}

		list, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}

		var pinnedMemoList []*api.Memo
		var unpinnedMemoList []*api.Memo

		for _, memo := range list {
			if memo.Pinned {
				pinnedMemoList = append(pinnedMemoList, memo)
			} else {
				unpinnedMemoList = append(unpinnedMemoList, memo)
			}
		}

		sort.Slice(pinnedMemoList, func(i, j int) bool {
			return pinnedMemoList[i].DisplayTs > pinnedMemoList[j].DisplayTs
		})
		sort.Slice(unpinnedMemoList, func(i, j int) bool {
			return unpinnedMemoList[i].DisplayTs > unpinnedMemoList[j].DisplayTs
		})

		memoList := []*api.Memo{}
		memoList = append(memoList, pinnedMemoList...)
		memoList = append(memoList, unpinnedMemoList...)

		if memoFind.Limit != 0 {
			memoList = memoList[memoFind.Offset:common.Min(len(memoList), memoFind.Offset+memoFind.Limit)]
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memoList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo list response").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo/amount", func(c echo.Context) error {
		ctx := c.Request().Context()
		normalRowStatus := api.Normal
		memoFind := &api.MemoFind{
			RowStatus: &normalRowStatus,
		}
		if userID, err := strconv.Atoi(c.QueryParam("userId")); err == nil {
			memoFind.CreatorID = &userID
		}

		memoList, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(len(memoList))); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo amount").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo/stats", func(c echo.Context) error {
		ctx := c.Request().Context()
		normalStatus := api.Normal
		memoFind := &api.MemoFind{
			RowStatus: &normalStatus,
		}
		if creatorID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			memoFind.CreatorID = &creatorID
		}
		if memoFind.CreatorID == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
		}

		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			memoFind.VisibilityList = []api.Visibility{api.Public}
		} else {
			if *memoFind.CreatorID != currentUserID {
				memoFind.VisibilityList = []api.Visibility{api.Public, api.Protected}
			} else {
				memoFind.VisibilityList = []api.Visibility{api.Public, api.Protected, api.Private}
			}
		}

		list, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}

		displayTsList := []int64{}
		for _, memo := range list {
			displayTsList = append(displayTsList, memo.DisplayTs)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(displayTsList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo stats response").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo/all", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoFind := &api.MemoFind{}

		_, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			memoFind.VisibilityList = []api.Visibility{api.Public}
		} else {
			memoFind.VisibilityList = []api.Visibility{api.Public, api.Protected}
		}

		pinnedStr := c.QueryParam("pinned")
		if pinnedStr != "" {
			pinned := pinnedStr == "true"
			memoFind.Pinned = &pinned
		}
		tag := c.QueryParam("tag")
		if tag != "" {
			contentSearch := "#" + tag + " "
			memoFind.ContentSearch = &contentSearch
		}
		visibilityListStr := c.QueryParam("visibility")
		if visibilityListStr != "" {
			visibilityList := []api.Visibility{}
			for _, visibility := range strings.Split(visibilityListStr, ",") {
				visibilityList = append(visibilityList, api.Visibility(visibility))
			}
			memoFind.VisibilityList = visibilityList
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			memoFind.Limit = limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			memoFind.Offset = offset
		}

		// Only fetch normal status memos.
		normalStatus := api.Normal
		memoFind.RowStatus = &normalStatus

		list, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch all memo list").SetInternal(err)
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].DisplayTs > list[j].DisplayTs
		})

		if memoFind.Limit != 0 {
			list = list[memoFind.Offset:common.Min(len(list), memoFind.Offset+memoFind.Limit)]
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode all memo list response").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoFind := &api.MemoFind{
			ID: &memoID,
		}
		memo, err := s.Store.FindMemo(ctx, memoFind)
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}

			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		if memo.Visibility == api.Private {
			if !ok || memo.CreatorID != userID {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is private only")
			}
		} else if memo.Visibility == api.Protected {
			if !ok {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is protected, missing user in session")
			}
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.POST("/memo/:memoId/organizer", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		memoOrganizerUpsert := &api.MemoOrganizerUpsert{
			MemoID: memoID,
			UserID: userID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoOrganizerUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo organizer request").SetInternal(err)
		}

		err = s.Store.UpsertMemoOrganizer(ctx, memoOrganizerUpsert)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo organizer").SetInternal(err)
		}

		memo, err := s.Store.FindMemo(ctx, &api.MemoFind{
			ID: &memoID,
		})
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}

			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.POST("/memo/:memoId/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		currentTs := time.Now().Unix()
		memoResourceUpsert := &api.MemoResourceUpsert{
			MemoID:    memoID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoResourceUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo resource request").SetInternal(err)
		}

		if _, err := s.Store.UpsertMemoResource(ctx, memoResourceUpsert); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
		}

		resourceFind := &api.ResourceFind{
			ID: &memoResourceUpsert.ResourceID,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource response").SetInternal(err)
		}
		return nil
	})

	g.GET("/memo/:memoId/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		resourceFind := &api.ResourceFind{
			MemoID: &memoID,
		}
		resourceList, err := s.Store.FindResourceList(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resourceList)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource list response").SetInternal(err)
		}
		return nil
	})

	g.DELETE("/memo/:memoId/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Memo ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Resource ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		memoResourceDelete := &api.MemoResourceDelete{
			MemoID:     &memoID,
			ResourceID: &resourceID,
		}
		if err := s.Store.DeleteMemoResource(ctx, memoResourceDelete); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})

	g.DELETE("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoFind := &api.MemoFind{
			ID:        &memoID,
			CreatorID: &userID,
		}
		if _, err := s.Store.FindMemo(ctx, memoFind); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}

		memoDelete := &api.MemoDelete{
			ID: memoID,
		}
		if err := s.Store.DeleteMemo(ctx, memoDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo ID: %v", memoID)).SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})
}
