package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerMemoRoutes(g *echo.Group) {
	g.POST("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memoCreate := &api.MemoCreate{}
		if err := json.NewDecoder(c.Request().Body).Decode(memoCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request").SetInternal(err)
		}

		if memoCreate.Visibility == "" {
			userMemoVisibilitySetting, err := s.Store.FindUserSetting(ctx, &api.UserSettingFind{
				UserID: userID,
				Key:    api.UserSettingMemoVisibilityKey,
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

		// Find system settings
		disablePublicMemosSystemSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingDisablePublicMemosName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
		}
		if disablePublicMemosSystemSetting != nil {
			disablePublicMemos := false
			err = json.Unmarshal([]byte(disablePublicMemosSystemSetting.Value), &disablePublicMemos)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting").SetInternal(err)
			}
			if disablePublicMemos {
				// Allow if the user is an admin.
				user, err := s.Store.FindUser(ctx, &api.UserFind{
					ID: &userID,
				})
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
				}
				// Only enforce private if you're a regular user.
				// Admins should know what they're doing.
				if user.Role == "USER" {
					memoCreate.Visibility = api.Private
				}
			}
		}

		if len(memoCreate.Content) > api.MaxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB").SetInternal(err)
		}

		memoCreate.CreatorID = userID
		memo, err := s.Store.CreateMemo(ctx, memoCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}
		if err := s.createMemoCreateActivity(c, memo); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}

		for _, resourceID := range memoCreate.ResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
				MemoID:     memo.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}

		for _, memoRelationUpsert := range memoCreate.RelationList {
			if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
				MemoID:        memo.ID,
				RelatedMemoID: memoRelationUpsert.RelatedMemoID,
				Type:          store.MemoRelationType(memoRelationUpsert.Type),
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
			}
		}

		memo, err = s.Store.ComposeMemo(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memo))
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

		memo, err := s.Store.FindMemo(ctx, &api.MemoFind{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		currentTs := time.Now().Unix()
		memoPatch := &api.MemoPatch{
			ID:        memoID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request").SetInternal(err)
		}

		if memoPatch.Content != nil && len(*memoPatch.Content) > api.MaxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB").SetInternal(err)
		}

		memo, err = s.Store.PatchMemo(ctx, memoPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch memo").SetInternal(err)
		}
		memo, err = s.Store.ComposeMemo(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}

		resourceIDList := make([]int, 0)
		for _, resource := range memo.ResourceList {
			resourceIDList = append(resourceIDList, resource.ID)
		}
		addedResourceIDList, removedResourceIDList := getIDListDiff(resourceIDList, memoPatch.ResourceIDList)
		for _, resourceID := range addedResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
				MemoID:     memo.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}
		for _, resourceID := range removedResourceIDList {
			if err := s.Store.DeleteMemoResource(ctx, &api.MemoResourceDelete{
				MemoID:     &memo.ID,
				ResourceID: &resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo resource").SetInternal(err)
			}
		}

		patchMemoRelationList := make([]*api.MemoRelation, 0)
		for _, memoRelationUpsert := range memoPatch.RelationList {
			patchMemoRelationList = append(patchMemoRelationList, &api.MemoRelation{
				MemoID:        memo.ID,
				RelatedMemoID: memoRelationUpsert.RelatedMemoID,
				Type:          memoRelationUpsert.Type,
			})
		}
		addedMemoRelationList, removedMemoRelationList := getMemoRelationListDiff(memo.RelationList, patchMemoRelationList)
		for _, memoRelation := range addedMemoRelationList {
			if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
				MemoID:        memo.ID,
				RelatedMemoID: memoRelation.RelatedMemoID,
				Type:          store.MemoRelationType(memoRelation.Type),
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
			}
		}
		for _, memoRelation := range removedMemoRelationList {
			memoRelationType := store.MemoRelationType(memoRelation.Type)
			if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelationMessage{
				MemoID:        &memo.ID,
				RelatedMemoID: &memoRelation.RelatedMemoID,
				Type:          &memoRelationType,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo relation").SetInternal(err)
			}
		}

		// After patching memo resources and relations, we need to re-compose it to get the latest data.
		memo, err = s.Store.ComposeMemo(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memo))
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
			contentSearch := "#" + tag
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
			memoFind.Limit = &limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			memoFind.Offset = &offset
		}

		list, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(list))
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
		return c.JSON(http.StatusOK, composeResponse(memo))
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
		memoOrganizerUpsert := &api.MemoOrganizerUpsert{}
		if err := json.NewDecoder(c.Request().Body).Decode(memoOrganizerUpsert); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo organizer request").SetInternal(err)
		}
		memoOrganizerUpsert.MemoID = memoID
		memoOrganizerUpsert.UserID = userID

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
		return c.JSON(http.StatusOK, composeResponse(memo))
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

		createdTsList := []int64{}
		for _, memo := range list {
			createdTsList = append(createdTsList, memo.CreatedTs)
		}
		return c.JSON(http.StatusOK, composeResponse(createdTsList))
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
			memoFind.Limit = &limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			memoFind.Offset = &offset
		}

		// Only fetch normal status memos.
		normalStatus := api.Normal
		memoFind.RowStatus = &normalStatus

		list, err := s.Store.FindMemoList(ctx, memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch all memo list").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(list))
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

		memo, err := s.Store.FindMemo(ctx, &api.MemoFind{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
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

func (s *Server) createMemoCreateActivity(c echo.Context, memo *api.Memo) error {
	ctx := c.Request().Context()
	payload := api.ActivityMemoCreatePayload{
		Content:    memo.Content,
		Visibility: memo.Visibility.String(),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: memo.CreatorID,
		Type:      api.ActivityMemoCreate,
		Level:     api.ActivityInfo,
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func getIDListDiff(oldList, newList []int) (addedList, removedList []int) {
	oldMap := map[int]bool{}
	for _, id := range oldList {
		oldMap[id] = true
	}
	newMap := map[int]bool{}
	for _, id := range newList {
		newMap[id] = true
	}
	for id := range oldMap {
		if !newMap[id] {
			removedList = append(removedList, id)
		}
	}
	for id := range newMap {
		if !oldMap[id] {
			addedList = append(addedList, id)
		}
	}
	return addedList, removedList
}

func getMemoRelationListDiff(oldList, newList []*api.MemoRelation) (addedList, removedList []*api.MemoRelation) {
	oldMap := map[string]bool{}
	for _, relation := range oldList {
		oldMap[fmt.Sprintf("%d-%s", relation.RelatedMemoID, relation.Type)] = true
	}
	newMap := map[string]bool{}
	for _, relation := range newList {
		newMap[fmt.Sprintf("%d-%s", relation.RelatedMemoID, relation.Type)] = true
	}
	for _, relation := range oldList {
		key := fmt.Sprintf("%d-%s", relation.RelatedMemoID, relation.Type)
		if !newMap[key] {
			removedList = append(removedList, relation)
		}
	}
	for _, relation := range newList {
		key := fmt.Sprintf("%d-%s", relation.RelatedMemoID, relation.Type)
		if !oldMap[key] {
			addedList = append(addedList, relation)
		}
	}
	return addedList, removedList
}
