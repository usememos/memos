package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
)

// maxContentLength means the max memo content bytes is 1MB.
const maxContentLength = 1 << 30

func (s *Server) registerMemoRoutes(g *echo.Group) {
	g.POST("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		createMemoRequest := &api.CreateMemoRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(createMemoRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request").SetInternal(err)
		}
		if len(createMemoRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB")
		}

		if createMemoRequest.Visibility == "" {
			userMemoVisibilitySetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
				UserID: &userID,
				Key:    apiv1.UserSettingMemoVisibilityKey.String(),
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
				createMemoRequest.Visibility = memoVisibility
			} else {
				// Private is the default memo visibility.
				createMemoRequest.Visibility = api.Private
			}
		}

		// Find disable public memos system setting.
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
				user, err := s.Store.FindUser(ctx, &api.UserFind{
					ID: &userID,
				})
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
				}
				// Enforce normal user to create private memo if public memos are disabled.
				if user.Role == "USER" {
					createMemoRequest.Visibility = api.Private
				}
			}
		}

		createMemoRequest.CreatorID = userID
		memoMessage, err := s.Store.CreateMemo(ctx, convertCreateMemoRequestToMemoMessage(createMemoRequest))
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}
		if err := createMemoCreateActivity(c.Request().Context(), s.Store, memoMessage); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}

		for _, resourceID := range createMemoRequest.ResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
				MemoID:     memoMessage.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}

		for _, memoRelationUpsert := range createMemoRequest.RelationList {
			if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelationMessage{
				MemoID:        memoMessage.ID,
				RelatedMemoID: memoRelationUpsert.RelatedMemoID,
				Type:          store.MemoRelationType(memoRelationUpsert.Type),
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
			}
		}

		memoMessage, err = s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoMessage.ID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}
		memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponse))
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

		memoMessage, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memoMessage.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		currentTs := time.Now().Unix()
		patchMemoRequest := &api.PatchMemoRequest{
			ID:        memoID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(patchMemoRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request").SetInternal(err)
		}

		if patchMemoRequest.Content != nil && len(*patchMemoRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB").SetInternal(err)
		}

		updateMemoMessage := &store.UpdateMemoMessage{
			ID:        memoID,
			CreatedTs: patchMemoRequest.CreatedTs,
			UpdatedTs: patchMemoRequest.UpdatedTs,
			Content:   patchMemoRequest.Content,
		}
		if patchMemoRequest.RowStatus != nil {
			rowStatus := store.RowStatus(patchMemoRequest.RowStatus.String())
			updateMemoMessage.RowStatus = &rowStatus
		}
		if patchMemoRequest.Visibility != nil {
			visibility := store.Visibility(patchMemoRequest.Visibility.String())
			updateMemoMessage.Visibility = &visibility
		}

		err = s.Store.UpdateMemo(ctx, updateMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch memo").SetInternal(err)
		}
		memoMessage, err = s.Store.GetMemo(ctx, &store.FindMemoMessage{ID: &memoID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}

		if patchMemoRequest.ResourceIDList != nil {
			addedResourceIDList, removedResourceIDList := getIDListDiff(memoMessage.ResourceIDList, patchMemoRequest.ResourceIDList)
			for _, resourceID := range addedResourceIDList {
				if _, err := s.Store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
					MemoID:     memoMessage.ID,
					ResourceID: resourceID,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
				}
			}
			for _, resourceID := range removedResourceIDList {
				if err := s.Store.DeleteMemoResource(ctx, &api.MemoResourceDelete{
					MemoID:     &memoMessage.ID,
					ResourceID: &resourceID,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo resource").SetInternal(err)
				}
			}
		}

		if patchMemoRequest.RelationList != nil {
			patchMemoRelationList := make([]*store.MemoRelationMessage, 0)
			for _, memoRelation := range patchMemoRequest.RelationList {
				patchMemoRelationList = append(patchMemoRelationList, &store.MemoRelationMessage{
					MemoID:        memoMessage.ID,
					RelatedMemoID: memoRelation.RelatedMemoID,
					Type:          store.MemoRelationType(memoRelation.Type),
				})
			}
			addedMemoRelationList, removedMemoRelationList := getMemoRelationListDiff(memoMessage.RelationList, patchMemoRelationList)
			for _, memoRelation := range addedMemoRelationList {
				if _, err := s.Store.UpsertMemoRelation(ctx, memoRelation); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
				}
			}
			for _, memoRelation := range removedMemoRelationList {
				if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelationMessage{
					MemoID:        &memoMessage.ID,
					RelatedMemoID: &memoRelation.RelatedMemoID,
					Type:          &memoRelation.Type,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo relation").SetInternal(err)
				}
			}
		}

		memoMessage, err = s.Store.GetMemo(ctx, &store.FindMemoMessage{ID: &memoID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponse))
	})

	g.GET("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		findMemoMessage := &store.FindMemoMessage{}
		if userID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			findMemoMessage.CreatorID = &userID
		}

		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			if findMemoMessage.CreatorID == nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
			}
			findMemoMessage.VisibilityList = []store.Visibility{store.Public}
		} else {
			if findMemoMessage.CreatorID == nil {
				findMemoMessage.CreatorID = &currentUserID
			} else {
				findMemoMessage.VisibilityList = []store.Visibility{store.Public, store.Protected}
			}
		}

		rowStatus := store.RowStatus(c.QueryParam("rowStatus"))
		if rowStatus != "" {
			findMemoMessage.RowStatus = &rowStatus
		}
		pinnedStr := c.QueryParam("pinned")
		if pinnedStr != "" {
			pinned := pinnedStr == "true"
			findMemoMessage.Pinned = &pinned
		}

		contentSearch := []string{}
		tag := c.QueryParam("tag")
		if tag != "" {
			contentSearch = append(contentSearch, "#"+tag)
		}
		contentSlice := c.QueryParams()["content"]
		if len(contentSlice) > 0 {
			contentSearch = append(contentSearch, contentSlice...)
		}
		findMemoMessage.ContentSearch = contentSearch

		visibilityListStr := c.QueryParam("visibility")
		if visibilityListStr != "" {
			visibilityList := []store.Visibility{}
			for _, visibility := range strings.Split(visibilityListStr, ",") {
				visibilityList = append(visibilityList, store.Visibility(visibility))
			}
			findMemoMessage.VisibilityList = visibilityList
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			findMemoMessage.Limit = &limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			findMemoMessage.Offset = &offset
		}

		memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get memo display with updated ts setting value").SetInternal(err)
		}
		if memoDisplayWithUpdatedTs {
			findMemoMessage.OrderByUpdatedTs = true
		}

		memoMessageList, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}
		memoResponseList := []*api.MemoResponse{}
		for _, memoMessage := range memoMessageList {
			memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponseList))
	})

	g.GET("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoMessage, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoID,
		})
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		if memoMessage.Visibility == store.Private {
			if !ok || memoMessage.CreatorID != userID {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is private only")
			}
		} else if memoMessage.Visibility == store.Protected {
			if !ok {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is protected, missing user in session")
			}
		}
		memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponse))
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

		memoMessage, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoID,
		})
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}
		memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponse))
	})

	g.GET("/memo/stats", func(c echo.Context) error {
		ctx := c.Request().Context()
		normalStatus := store.Normal
		findMemoMessage := &store.FindMemoMessage{
			RowStatus: &normalStatus,
		}
		if creatorID, err := strconv.Atoi(c.QueryParam("creatorId")); err == nil {
			findMemoMessage.CreatorID = &creatorID
		}
		if findMemoMessage.CreatorID == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
		}

		currentUserID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			findMemoMessage.VisibilityList = []store.Visibility{store.Public}
		} else {
			if *findMemoMessage.CreatorID != currentUserID {
				findMemoMessage.VisibilityList = []store.Visibility{store.Public, store.Protected}
			} else {
				findMemoMessage.VisibilityList = []store.Visibility{store.Public, store.Protected, store.Private}
			}
		}

		memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get memo display with updated ts setting value").SetInternal(err)
		}
		if memoDisplayWithUpdatedTs {
			findMemoMessage.OrderByUpdatedTs = true
		}

		memoMessageList, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}
		memoResponseList := []*api.MemoResponse{}
		for _, memoMessage := range memoMessageList {
			memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}

		displayTsList := []int64{}
		for _, memo := range memoResponseList {
			displayTsList = append(displayTsList, memo.DisplayTs)
		}
		return c.JSON(http.StatusOK, composeResponse(displayTsList))
	})

	g.GET("/memo/all", func(c echo.Context) error {
		ctx := c.Request().Context()
		findMemoMessage := &store.FindMemoMessage{}
		_, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			findMemoMessage.VisibilityList = []store.Visibility{store.Public}
		} else {
			findMemoMessage.VisibilityList = []store.Visibility{store.Public, store.Protected}
		}

		pinnedStr := c.QueryParam("pinned")
		if pinnedStr != "" {
			pinned := pinnedStr == "true"
			findMemoMessage.Pinned = &pinned
		}

		contentSearch := []string{}
		tag := c.QueryParam("tag")
		if tag != "" {
			contentSearch = append(contentSearch, "#"+tag+" ")
		}
		contentSlice := c.QueryParams()["content"]
		if len(contentSlice) > 0 {
			contentSearch = append(contentSearch, contentSlice...)
		}
		findMemoMessage.ContentSearch = contentSearch

		visibilityListStr := c.QueryParam("visibility")
		if visibilityListStr != "" {
			visibilityList := []store.Visibility{}
			for _, visibility := range strings.Split(visibilityListStr, ",") {
				visibilityList = append(visibilityList, store.Visibility(visibility))
			}
			findMemoMessage.VisibilityList = visibilityList
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			findMemoMessage.Limit = &limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			findMemoMessage.Offset = &offset
		}

		// Only fetch normal status memos.
		normalStatus := store.Normal
		findMemoMessage.RowStatus = &normalStatus

		memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get memo display with updated ts setting value").SetInternal(err)
		}
		if memoDisplayWithUpdatedTs {
			findMemoMessage.OrderByUpdatedTs = true
		}

		memoMessageList, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch all memo list").SetInternal(err)
		}
		memoResponseList := []*api.MemoResponse{}
		for _, memoMessage := range memoMessageList {
			memoResponse, err := s.composeMemoMessageToMemoResponse(ctx, memoMessage)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}
		return c.JSON(http.StatusOK, composeResponse(memoResponseList))
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

		memo, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if err := s.Store.DeleteMemo(ctx, &store.DeleteMemoMessage{
			ID: memoID,
		}); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo ID: %v", memoID)).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func createMemoCreateActivity(ctx context.Context, store *store.Store, memo *store.MemoMessage) error {
	payload := api.ActivityMemoCreatePayload{
		Content:    memo.Content,
		Visibility: memo.Visibility.String(),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := store.CreateActivity(ctx, &api.ActivityCreate{
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

func getMemoRelationListDiff(oldList, newList []*store.MemoRelationMessage) (addedList, removedList []*store.MemoRelationMessage) {
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

func convertCreateMemoRequestToMemoMessage(memoCreate *api.CreateMemoRequest) *store.MemoMessage {
	createdTs := time.Now().Unix()
	if memoCreate.CreatedTs != nil {
		createdTs = *memoCreate.CreatedTs
	}
	return &store.MemoMessage{
		CreatorID:  memoCreate.CreatorID,
		CreatedTs:  createdTs,
		Content:    memoCreate.Content,
		Visibility: store.Visibility(memoCreate.Visibility),
	}
}

func (s *Server) composeMemoMessageToMemoResponse(ctx context.Context, memoMessage *store.MemoMessage) (*api.MemoResponse, error) {
	memoResponse := &api.MemoResponse{
		ID:         memoMessage.ID,
		RowStatus:  api.RowStatus(memoMessage.RowStatus.String()),
		CreatorID:  memoMessage.CreatorID,
		CreatedTs:  memoMessage.CreatedTs,
		UpdatedTs:  memoMessage.UpdatedTs,
		Content:    memoMessage.Content,
		Visibility: api.Visibility(memoMessage.Visibility.String()),
		Pinned:     memoMessage.Pinned,
	}

	// Compose creator name.
	user, err := s.Store.FindUser(ctx, &api.UserFind{
		ID: &memoResponse.CreatorID,
	})
	if err != nil {
		return nil, err
	}
	if user.Nickname != "" {
		memoResponse.CreatorName = user.Nickname
	} else {
		memoResponse.CreatorName = user.Username
	}

	// Compose display ts.
	memoResponse.DisplayTs = memoResponse.CreatedTs
	// Find memo display with updated ts setting.
	memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return nil, err
	}
	if memoDisplayWithUpdatedTs {
		memoResponse.DisplayTs = memoResponse.UpdatedTs
	}

	relationList := []*api.MemoRelation{}
	for _, relation := range memoMessage.RelationList {
		relationList = append(relationList, convertMemoRelationMessageToMemoRelation(relation))
	}
	memoResponse.RelationList = relationList

	resourceList := []*api.Resource{}
	for _, resourceID := range memoMessage.ResourceIDList {
		resource, err := s.Store.FindResource(ctx, &api.ResourceFind{
			ID: &resourceID,
		})
		if err != nil {
			return nil, err
		}
		resourceList = append(resourceList, resource)
	}
	memoResponse.ResourceList = resourceList

	return memoResponse, nil
}

func (s *Server) getMemoDisplayWithUpdatedTsSettingValue(ctx context.Context) (bool, error) {
	memoDisplayWithUpdatedTsSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
		Name: api.SystemSettingMemoDisplayWithUpdatedTsName,
	})
	if err != nil && common.ErrorCode(err) != common.NotFound {
		return false, errors.Wrap(err, "failed to find system setting")
	}
	memoDisplayWithUpdatedTs := false
	if memoDisplayWithUpdatedTsSetting != nil {
		err = json.Unmarshal([]byte(memoDisplayWithUpdatedTsSetting.Value), &memoDisplayWithUpdatedTs)
		if err != nil {
			return false, errors.Wrap(err, "failed to unmarshal system setting value")
		}
	}
	return memoDisplayWithUpdatedTs, nil
}
