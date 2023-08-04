package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Protected is the PROTECTED visibility.
	Protected Visibility = "PROTECTED"
	// Private is the PRIVATE visibility.
	Private Visibility = "PRIVATE"
)

func (v Visibility) String() string {
	switch v {
	case Public:
		return "PUBLIC"
	case Protected:
		return "PROTECTED"
	case Private:
		return "PRIVATE"
	}
	return "PRIVATE"
}

type Memo struct {
	ID int32 `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int32     `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	DisplayTs  int64      `json:"displayTs"`
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`
	Pinned     bool       `json:"pinned"`

	// Related fields
	CreatorName     string          `json:"creatorName"`
	CreatorUsername string          `json:"creatorUsername"`
	ResourceList    []*Resource     `json:"resourceList"`
	RelationList    []*MemoRelation `json:"relationList"`
}

type CreateMemoRequest struct {
	// Standard fields
	CreatorID int32  `json:"-"`
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Visibility Visibility `json:"visibility"`
	Content    string     `json:"content"`

	// Related fields
	ResourceIDList []int32                      `json:"resourceIdList"`
	RelationList   []*UpsertMemoRelationRequest `json:"relationList"`
}

type PatchMemoRequest struct {
	ID int32 `json:"-"`

	// Standard fields
	CreatedTs *int64 `json:"createdTs"`
	UpdatedTs *int64
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Content    *string     `json:"content"`
	Visibility *Visibility `json:"visibility"`

	// Related fields
	ResourceIDList []int32                      `json:"resourceIdList"`
	RelationList   []*UpsertMemoRelationRequest `json:"relationList"`
}

type FindMemoRequest struct {
	ID *int32

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int32

	// Domain specific fields
	Pinned         *bool
	ContentSearch  []string
	VisibilityList []Visibility

	// Pagination
	Limit  *int
	Offset *int
}

// maxContentLength means the max memo content bytes is 1MB.
const maxContentLength = 1 << 30

func (s *APIV1Service) registerMemoRoutes(g *echo.Group) {
	g.POST("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int32)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		createMemoRequest := &CreateMemoRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(createMemoRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request").SetInternal(err)
		}
		if len(createMemoRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB")
		}

		if createMemoRequest.Visibility == "" {
			userMemoVisibilitySetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
				UserID: &userID,
				Key:    UserSettingMemoVisibilityKey.String(),
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user setting").SetInternal(err)
			}
			if userMemoVisibilitySetting != nil {
				memoVisibility := Private
				err := json.Unmarshal([]byte(userMemoVisibilitySetting.Value), &memoVisibility)
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal user setting value").SetInternal(err)
				}
				createMemoRequest.Visibility = memoVisibility
			} else {
				// Private is the default memo visibility.
				createMemoRequest.Visibility = Private
			}
		}

		// Find disable public memos system setting.
		disablePublicMemosSystemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingDisablePublicMemosName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
		}
		if disablePublicMemosSystemSetting != nil {
			disablePublicMemos := false
			err = json.Unmarshal([]byte(disablePublicMemosSystemSetting.Value), &disablePublicMemos)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting").SetInternal(err)
			}
			if disablePublicMemos {
				user, err := s.Store.GetUser(ctx, &store.FindUser{
					ID: &userID,
				})
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user").SetInternal(err)
				}
				if user == nil {
					return echo.NewHTTPError(http.StatusNotFound, "User not found")
				}
				// Enforce normal user to create private memo if public memos are disabled.
				if user.Role == store.RoleUser {
					createMemoRequest.Visibility = Private
				}
			}
		}

		createMemoRequest.CreatorID = userID
		memo, err := s.Store.CreateMemo(ctx, convertCreateMemoRequestToMemoMessage(createMemoRequest))
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}
		if err := s.createMemoCreateActivity(ctx, memo); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}

		for _, resourceID := range createMemoRequest.ResourceIDList {
			if _, err := s.Store.UpsertMemoResource(ctx, &store.UpsertMemoResource{
				MemoID:     memo.ID,
				ResourceID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}

		for _, memoRelationUpsert := range createMemoRequest.RelationList {
			if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
				MemoID:        memo.ID,
				RelatedMemoID: memoRelationUpsert.RelatedMemoID,
				Type:          store.MemoRelationType(memoRelationUpsert.Type),
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
			}
		}

		memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memo.ID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memo.ID))
		}

		memoResponse, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoResponse)
	})

	g.PATCH("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int32)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memoID))
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		currentTs := time.Now().Unix()
		patchMemoRequest := &PatchMemoRequest{
			ID:        memoID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(patchMemoRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request").SetInternal(err)
		}

		if patchMemoRequest.Content != nil && len(*patchMemoRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB").SetInternal(err)
		}

		updateMemoMessage := &store.UpdateMemo{
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
		memo, err = s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memoID))
		}

		if patchMemoRequest.ResourceIDList != nil {
			addedResourceIDList, removedResourceIDList := getIDListDiff(memo.ResourceIDList, patchMemoRequest.ResourceIDList)
			for _, resourceID := range addedResourceIDList {
				if _, err := s.Store.UpsertMemoResource(ctx, &store.UpsertMemoResource{
					MemoID:     memo.ID,
					ResourceID: resourceID,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
				}
			}
			for _, resourceID := range removedResourceIDList {
				if err := s.Store.DeleteMemoResource(ctx, &store.DeleteMemoResource{
					MemoID:     &memo.ID,
					ResourceID: &resourceID,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo resource").SetInternal(err)
				}
			}
		}

		if patchMemoRequest.RelationList != nil {
			patchMemoRelationList := make([]*store.MemoRelation, 0)
			for _, memoRelation := range patchMemoRequest.RelationList {
				patchMemoRelationList = append(patchMemoRelationList, &store.MemoRelation{
					MemoID:        memo.ID,
					RelatedMemoID: memoRelation.RelatedMemoID,
					Type:          store.MemoRelationType(memoRelation.Type),
				})
			}
			addedMemoRelationList, removedMemoRelationList := getMemoRelationListDiff(memo.RelationList, patchMemoRelationList)
			for _, memoRelation := range addedMemoRelationList {
				if _, err := s.Store.UpsertMemoRelation(ctx, memoRelation); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo relation").SetInternal(err)
				}
			}
			for _, memoRelation := range removedMemoRelationList {
				if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
					MemoID:        &memo.ID,
					RelatedMemoID: &memoRelation.RelatedMemoID,
					Type:          &memoRelation.Type,
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete memo relation").SetInternal(err)
				}
			}
		}

		memo, err = s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memoID))
		}

		memoResponse, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoResponse)
	})

	g.GET("/memo", func(c echo.Context) error {
		ctx := c.Request().Context()
		findMemoMessage := &store.FindMemo{}
		if userID, err := util.ConvertStringToInt32(c.QueryParam("creatorId")); err == nil {
			findMemoMessage.CreatorID = &userID
		}

		if username := c.QueryParam("creatorUsername"); username != "" {
			user, _ := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
			if user != nil {
				findMemoMessage.CreatorID = &user.ID
			}
		}

		currentUserID, ok := c.Get(auth.UserIDContextKey).(int32)
		if !ok {
			// Anonymous use should only fetch PUBLIC memos with specified user
			if findMemoMessage.CreatorID == nil {
				return echo.NewHTTPError(http.StatusBadRequest, "Missing user to find memo")
			}
			findMemoMessage.VisibilityList = []store.Visibility{store.Public}
		} else {
			// Authorized user can fetch all PUBLIC/PROTECTED memo
			visibilityList := []store.Visibility{store.Public, store.Protected}

			// If Creator is authorized user (as default), PRIVATE memo is OK
			if findMemoMessage.CreatorID == nil || *findMemoMessage.CreatorID == currentUserID {
				findMemoMessage.CreatorID = &currentUserID
				visibilityList = append(visibilityList, store.Private)
			}
			findMemoMessage.VisibilityList = visibilityList
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

		list, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}
		memoResponseList := []*Memo{}
		for _, memo := range list {
			memoResponse, err := s.convertMemoFromStore(ctx, memo)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}
		return c.JSON(http.StatusOK, memoResponseList)
	})

	g.GET("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memoID))
		}

		userID, ok := c.Get(auth.UserIDContextKey).(int32)
		if memo.Visibility == store.Private {
			if !ok || memo.CreatorID != userID {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is private only")
			}
		} else if memo.Visibility == store.Protected {
			if !ok {
				return echo.NewHTTPError(http.StatusForbidden, "this memo is protected, missing user in session")
			}
		}
		memoResponse, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoResponse)
	})

	g.GET("/memo/stats", func(c echo.Context) error {
		ctx := c.Request().Context()
		normalStatus := store.Normal
		findMemoMessage := &store.FindMemo{
			RowStatus: &normalStatus,
		}
		if creatorID, err := util.ConvertStringToInt32(c.QueryParam("creatorId")); err == nil {
			findMemoMessage.CreatorID = &creatorID
		}

		if username := c.QueryParam("creatorUsername"); username != "" {
			user, _ := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
			if user != nil {
				findMemoMessage.CreatorID = &user.ID
			}
		}

		if findMemoMessage.CreatorID == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user id to find memo")
		}

		currentUserID, ok := c.Get(auth.UserIDContextKey).(int32)
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

		list, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo list").SetInternal(err)
		}
		memoResponseList := []*Memo{}
		for _, memo := range list {
			memoResponse, err := s.convertMemoFromStore(ctx, memo)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}

		displayTsList := []int64{}
		for _, memo := range memoResponseList {
			displayTsList = append(displayTsList, memo.DisplayTs)
		}
		return c.JSON(http.StatusOK, displayTsList)
	})

	g.GET("/memo/all", func(c echo.Context) error {
		ctx := c.Request().Context()
		findMemoMessage := &store.FindMemo{}
		_, ok := c.Get(auth.UserIDContextKey).(int)
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

		list, err := s.Store.ListMemos(ctx, findMemoMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch all memo list").SetInternal(err)
		}
		memoResponseList := []*Memo{}
		for _, memo := range list {
			memoResponse, err := s.convertMemoFromStore(ctx, memo)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
			}
			memoResponseList = append(memoResponseList, memoResponse)
		}
		return c.JSON(http.StatusOK, memoResponseList)
	})

	g.DELETE("/memo/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(auth.UserIDContextKey).(int32)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		memoID, err := util.ConvertStringToInt32(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		if memo == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memoID))
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if err := s.Store.DeleteMemo(ctx, &store.DeleteMemo{
			ID: memoID,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo ID: %v", memoID)).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func (s *APIV1Service) createMemoCreateActivity(ctx context.Context, memo *store.Memo) error {
	payload := ActivityMemoCreatePayload{
		Content:    memo.Content,
		Visibility: memo.Visibility.String(),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: memo.CreatorID,
		Type:      ActivityMemoCreate.String(),
		Level:     ActivityInfo.String(),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memo *store.Memo) (*Memo, error) {
	memoResponse := &Memo{
		ID:         memo.ID,
		RowStatus:  RowStatus(memo.RowStatus.String()),
		CreatorID:  memo.CreatorID,
		CreatedTs:  memo.CreatedTs,
		UpdatedTs:  memo.UpdatedTs,
		Content:    memo.Content,
		Visibility: Visibility(memo.Visibility.String()),
		Pinned:     memo.Pinned,
	}

	// Compose creator name.
	user, err := s.Store.GetUser(ctx, &store.FindUser{
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

	memoResponse.CreatorUsername = user.Username

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

	relationList := []*MemoRelation{}
	for _, relation := range memo.RelationList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}
	memoResponse.RelationList = relationList

	resourceList := []*Resource{}
	for _, resourceID := range memo.ResourceIDList {
		resource, err := s.Store.GetResource(ctx, &store.FindResource{
			ID: &resourceID,
		})
		if err != nil {
			return nil, err
		}
		if resource != nil {
			resourceList = append(resourceList, convertResourceFromStore(resource))
		}
	}
	memoResponse.ResourceList = resourceList

	return memoResponse, nil
}

func (s *APIV1Service) getMemoDisplayWithUpdatedTsSettingValue(ctx context.Context) (bool, error) {
	memoDisplayWithUpdatedTsSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: SystemSettingMemoDisplayWithUpdatedTsName.String(),
	})
	if err != nil {
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

func convertCreateMemoRequestToMemoMessage(memoCreate *CreateMemoRequest) *store.Memo {
	createdTs := time.Now().Unix()
	if memoCreate.CreatedTs != nil {
		createdTs = *memoCreate.CreatedTs
	}
	return &store.Memo{
		CreatorID:  memoCreate.CreatorID,
		CreatedTs:  createdTs,
		Content:    memoCreate.Content,
		Visibility: store.Visibility(memoCreate.Visibility),
	}
}

func getMemoRelationListDiff(oldList, newList []*store.MemoRelation) (addedList, removedList []*store.MemoRelation) {
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

func getIDListDiff(oldList, newList []int32) (addedList, removedList []int32) {
	oldMap := map[int32]bool{}
	for _, id := range oldList {
		oldMap[id] = true
	}
	newMap := map[int32]bool{}
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
