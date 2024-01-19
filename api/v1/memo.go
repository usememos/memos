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
	"go.uber.org/zap"

	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/webhook"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/service/metric"
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
	g.GET("/memo", s.GetMemoList)
	g.POST("/memo", s.CreateMemo)
	g.GET("/memo/all", s.GetAllMemos)
	g.GET("/memo/stats", s.GetMemoStats)
	g.GET("/memo/:memoId", s.GetMemo)
	g.PATCH("/memo/:memoId", s.UpdateMemo)
	g.DELETE("/memo/:memoId", s.DeleteMemo)
}

// GetMemoList godoc
//
//	@Summary	Get a list of memos matching optional filters
//	@Tags		memo
//	@Produce	json
//	@Param		creatorId		query		int				false	"Creator ID"
//	@Param		creatorUsername	query		string			false	"Creator username"
//	@Param		rowStatus		query		store.RowStatus	false	"Row status"
//	@Param		pinned			query		bool			false	"Pinned"
//	@Param		tag				query		string			false	"Search for tag. Do not append #"
//	@Param		content			query		string			false	"Search for content"
//	@Param		limit			query		int				false	"Limit"
//	@Param		offset			query		int				false	"Offset"
//	@Success	200				{object}	[]store.Memo	"Memo list"
//	@Failure	400				{object}	nil				"Missing user to find memo"
//	@Failure	500				{object}	nil				"Failed to get memo display with updated ts setting value | Failed to fetch memo list | Failed to compose memo response"
//	@Router		/api/v1/memo [GET]
func (s *APIV1Service) GetMemoList(c echo.Context) error {
	ctx := c.Request().Context()
	find := &store.FindMemo{
		OrderByPinned: true,
	}
	if userID, err := util.ConvertStringToInt32(c.QueryParam("creatorId")); err == nil {
		find.CreatorID = &userID
	}

	if username := c.QueryParam("creatorUsername"); username != "" {
		user, _ := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
		if user != nil {
			find.CreatorID = &user.ID
		}
	}

	currentUserID, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		// Anonymous use should only fetch PUBLIC memos with specified user
		if find.CreatorID == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Missing user to find memo")
		}
		find.VisibilityList = []store.Visibility{store.Public}
	} else {
		// Authorized user can fetch all PUBLIC/PROTECTED memo
		visibilityList := []store.Visibility{store.Public, store.Protected}

		// If Creator is authorized user (as default), PRIVATE memo is OK
		if find.CreatorID == nil || *find.CreatorID == currentUserID {
			find.CreatorID = &currentUserID
			visibilityList = append(visibilityList, store.Private)
		}
		find.VisibilityList = visibilityList
	}

	rowStatus := store.RowStatus(c.QueryParam("rowStatus"))
	if rowStatus != "" {
		find.RowStatus = &rowStatus
	}

	contentSearch := []string{}
	tag := c.QueryParam("tag")
	if tag != "" {
		contentSearch = append(contentSearch, "#"+tag)
	}
	content := c.QueryParam("content")
	if content != "" {
		contentSearch = append(contentSearch, content)
	}
	find.ContentSearch = contentSearch

	if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		find.Limit = &limit
	}
	if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		find.Offset = &offset
	}

	memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get memo display with updated ts setting value").SetInternal(err)
	}
	if memoDisplayWithUpdatedTs {
		find.OrderByUpdatedTs = true
	}

	list, err := s.Store.ListMemos(ctx, find)
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
}

// CreateMemo godoc
//
//	@Summary		Create a memo
//	@Description	Visibility can be PUBLIC, PROTECTED or PRIVATE
//	@Description	*You should omit fields to use their default values
//	@Tags			memo
//	@Accept			json
//	@Produce		json
//	@Param			body	body		CreateMemoRequest	true	"Request object."
//	@Success		200		{object}	store.Memo			"Stored memo"
//	@Failure		400		{object}	nil					"Malformatted post memo request | Content size overflow, up to 1MB"
//	@Failure		401		{object}	nil					"Missing user in session"
//	@Failure		404		{object}	nil					"User not found | Memo not found: %d"
//	@Failure		500		{object}	nil					"Failed to find user setting | Failed to unmarshal user setting value | Failed to find system setting | Failed to unmarshal system setting | Failed to find user | Failed to create memo | Failed to create activity | Failed to upsert memo resource | Failed to upsert memo relation | Failed to compose memo | Failed to compose memo response"
//	@Router			/api/v1/memo [POST]
//
// NOTES:
// - It's currently possible to create phantom resources and relations. Phantom relations will trigger backend 404's when fetching memo.
func (s *APIV1Service) CreateMemo(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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
			Key:    storepb.UserSettingKey_USER_SETTING_MEMO_VISIBILITY,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user setting").SetInternal(err)
		}
		if userMemoVisibilitySetting != nil {
			createMemoRequest.Visibility = Visibility(userMemoVisibilitySetting.GetMemoVisibility())
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

	for _, resourceID := range createMemoRequest.ResourceIDList {
		if _, err := s.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:     resourceID,
			MemoID: &memo.ID,
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
		if memo.Visibility != store.Private && memoRelationUpsert.Type == MemoRelationComment {
			relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{
				ID: &memoRelationUpsert.RelatedMemoID,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get related memo").SetInternal(err)
			}
			if relatedMemo.CreatorID != memo.CreatorID {
				activity, err := s.Store.CreateActivity(ctx, &store.Activity{
					CreatorID: memo.CreatorID,
					Type:      store.ActivityTypeMemoComment,
					Level:     store.ActivityLevelInfo,
					Payload: &storepb.ActivityPayload{
						MemoComment: &storepb.ActivityMemoCommentPayload{
							MemoId:        memo.ID,
							RelatedMemoId: memoRelationUpsert.RelatedMemoID,
						},
					},
				})
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
				}
				metric.Enqueue("memo comment create")
				if _, err := s.Store.CreateInbox(ctx, &store.Inbox{
					SenderID:   memo.CreatorID,
					ReceiverID: relatedMemo.CreatorID,
					Status:     store.UNREAD,
					Message: &storepb.InboxMessage{
						Type:       storepb.InboxMessage_TYPE_MEMO_COMMENT,
						ActivityId: &activity.ID,
					},
				}); err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create inbox").SetInternal(err)
				}
			}
		}
	}

	composedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
	}
	if composedMemo == nil {
		return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo not found: %d", memo.ID))
	}

	memoResponse, err := s.convertMemoFromStore(ctx, composedMemo)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo response").SetInternal(err)
	}

	// Send notification to telegram if memo is not private.
	if memoResponse.Visibility != Private {
		// fetch all telegram UserID
		userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{Key: storepb.UserSettingKey_USER_SETTING_TELEGRAM_USER_ID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to ListUserSettings").SetInternal(err)
		}
		for _, userSetting := range userSettings {
			tgUserID, err := strconv.ParseInt(userSetting.GetTelegramUserId(), 10, 64)
			if err != nil {
				log.Error("failed to parse Telegram UserID", zap.Error(err))
				continue
			}

			// send notification to telegram
			content := memoResponse.CreatorName + " Says:\n\n" + memoResponse.Content
			_, err = s.telegramBot.SendMessage(ctx, tgUserID, content)
			if err != nil {
				log.Error("Failed to send Telegram notification", zap.Error(err))
				continue
			}
		}
	}
	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, memoResponse); err != nil {
		log.Warn("Failed to dispatch memo created webhook", zap.Error(err))
	}

	metric.Enqueue("memo create")
	return c.JSON(http.StatusOK, memoResponse)
}

// GetAllMemos godoc
//
//	@Summary		Get a list of public memos matching optional filters
//	@Description	This should also list protected memos if the user is logged in
//	@Description	Authentication is optional
//	@Tags			memo
//	@Produce		json
//	@Param			limit	query		int				false	"Limit"
//	@Param			offset	query		int				false	"Offset"
//	@Success		200		{object}	[]store.Memo	"Memo list"
//	@Failure		500		{object}	nil				"Failed to get memo display with updated ts setting value | Failed to fetch all memo list | Failed to compose memo response"
//	@Router			/api/v1/memo/all [GET]
//
//	NOTES:
//	- creatorUsername is listed at ./web/src/helpers/api.ts:82, but it's not present here
func (s *APIV1Service) GetAllMemos(c echo.Context) error {
	ctx := c.Request().Context()
	memoFind := &store.FindMemo{}
	_, ok := c.Get(userIDContextKey).(int32)
	if !ok {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		memoFind.Limit = &limit
	}
	if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		memoFind.Offset = &offset
	}

	// Only fetch normal status memos.
	normalStatus := store.Normal
	memoFind.RowStatus = &normalStatus

	memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get memo display with updated ts setting value").SetInternal(err)
	}
	if memoDisplayWithUpdatedTs {
		memoFind.OrderByUpdatedTs = true
	}

	list, err := s.Store.ListMemos(ctx, memoFind)
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
}

// GetMemoStats godoc
//
//	@Summary		Get memo stats by creator ID or username
//	@Description	Used to generate the heatmap
//	@Tags			memo
//	@Produce		json
//	@Param			creatorId		query		int		false	"Creator ID"
//	@Param			creatorUsername	query		string	false	"Creator username"
//	@Success		200				{object}	[]int	"Memo createdTs list"
//	@Failure		400				{object}	nil		"Missing user id to find memo"
//	@Failure		500				{object}	nil		"Failed to get memo display with updated ts setting value | Failed to find memo list | Failed to compose memo response"
//	@Router			/api/v1/memo/stats [GET]
func (s *APIV1Service) GetMemoStats(c echo.Context) error {
	ctx := c.Request().Context()
	normalStatus := store.Normal
	findMemoMessage := &store.FindMemo{
		RowStatus:      &normalStatus,
		ExcludeContent: true,
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

	currentUserID, ok := c.Get(userIDContextKey).(int32)
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

	displayTsList := []int64{}
	if memoDisplayWithUpdatedTs {
		for _, memo := range list {
			displayTsList = append(displayTsList, memo.UpdatedTs)
		}
	} else {
		for _, memo := range list {
			displayTsList = append(displayTsList, memo.CreatedTs)
		}
	}
	return c.JSON(http.StatusOK, displayTsList)
}

// GetMemo godoc
//
//	@Summary	Get memo by ID
//	@Tags		memo
//	@Produce	json
//	@Param		memoId	path		int				true	"Memo ID"
//	@Success	200		{object}	[]store.Memo	"Memo list"
//	@Failure	400		{object}	nil				"ID is not a number: %s"
//	@Failure	401		{object}	nil				"Missing user in session"
//	@Failure	403		{object}	nil				"this memo is private only | this memo is protected, missing user in session
//	@Failure	404		{object}	nil				"Memo not found: %d"
//	@Failure	500		{object}	nil				"Failed to find memo by ID: %v | Failed to compose memo response"
//	@Router		/api/v1/memo/{memoId} [GET]
func (s *APIV1Service) GetMemo(c echo.Context) error {
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

	userID, ok := c.Get(userIDContextKey).(int32)
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
}

// DeleteMemo godoc
//
//	@Summary	Delete memo by ID
//	@Tags		memo
//	@Produce	json
//	@Param		memoId	path		int		true	"Memo ID to delete"
//	@Success	200		{boolean}	true	"Memo deleted"
//	@Failure	400		{object}	nil		"ID is not a number: %s"
//	@Failure	401		{object}	nil		"Missing user in session | Unauthorized"
//	@Failure	404		{object}	nil		"Memo not found: %d"
//	@Failure	500		{object}	nil		"Failed to find memo | Failed to delete memo ID: %v"
//	@Router		/api/v1/memo/{memoId} [DELETE]
func (s *APIV1Service) DeleteMemo(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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

	if memoMessage, err := s.convertMemoFromStore(ctx, memo); err == nil {
		// Try to dispatch webhook when memo is deleted.
		if err := s.DispatchMemoDeletedWebhook(ctx, memoMessage); err != nil {
			log.Warn("Failed to dispatch memo deleted webhook", zap.Error(err))
		}
	}

	if err := s.Store.DeleteMemo(ctx, &store.DeleteMemo{
		ID: memoID,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo ID: %v", memoID)).SetInternal(err)
	}
	return c.JSON(http.StatusOK, true)
}

// UpdateMemo godoc
//
//	@Summary		Update a memo
//	@Description	Visibility can be PUBLIC, PROTECTED or PRIVATE
//	@Description	*You should omit fields to use their default values
//	@Tags			memo
//	@Accept			json
//	@Produce		json
//	@Param			memoId	path		int					true	"ID of memo to update"
//	@Param			body	body		PatchMemoRequest	true	"Patched object."
//	@Success		200		{object}	store.Memo			"Stored memo"
//	@Failure		400		{object}	nil					"ID is not a number: %s | Malformatted patch memo request | Content size overflow, up to 1MB"
//	@Failure		401		{object}	nil					"Missing user in session | Unauthorized"
//	@Failure		404		{object}	nil					"Memo not found: %d"
//	@Failure		500		{object}	nil					"Failed to find memo | Failed to patch memo | Failed to upsert memo resource | Failed to delete memo resource | Failed to compose memo response"
//	@Router			/api/v1/memo/{memoId} [PATCH]
//
// NOTES:
// - It's currently possible to create phantom resources and relations. Phantom relations will trigger backend 404's when fetching memo.
// - Passing 0 to createdTs and updatedTs will set them to 0 in the database, which is probably unwanted.
func (s *APIV1Service) UpdateMemo(c echo.Context) error {
	ctx := c.Request().Context()
	userID, ok := c.Get(userIDContextKey).(int32)
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

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
	}
	if patchMemoRequest.ResourceIDList != nil {
		originResourceIDList := []int32{}
		for _, resource := range memoMessage.ResourceList {
			originResourceIDList = append(originResourceIDList, resource.ID)
		}
		addedResourceIDList, removedResourceIDList := getIDListDiff(originResourceIDList, patchMemoRequest.ResourceIDList)
		for _, resourceID := range addedResourceIDList {
			if _, err := s.Store.UpdateResource(ctx, &store.UpdateResource{
				ID:     resourceID,
				MemoID: &memo.ID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upsert memo resource").SetInternal(err)
			}
		}
		for _, resourceID := range removedResourceIDList {
			if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
				ID: resourceID,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete resource").SetInternal(err)
			}
		}
	}

	if patchMemoRequest.RelationList != nil {
		patchMemoRelationList := make([]*MemoRelation, 0)
		for _, memoRelation := range patchMemoRequest.RelationList {
			patchMemoRelationList = append(patchMemoRelationList, &MemoRelation{
				MemoID:        memo.ID,
				RelatedMemoID: memoRelation.RelatedMemoID,
				Type:          memoRelation.Type,
			})
		}
		addedMemoRelationList, removedMemoRelationList := getMemoRelationListDiff(memoMessage.RelationList, patchMemoRelationList)
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
	// Try to dispatch webhook when memo is updated.
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoResponse); err != nil {
		log.Warn("Failed to dispatch memo updated webhook", zap.Error(err))
	}

	return c.JSON(http.StatusOK, memoResponse)
}

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memo *store.Memo) (*Memo, error) {
	memoMessage := &Memo{
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
		ID: &memoMessage.CreatorID,
	})
	if err != nil {
		return nil, err
	}
	if user.Nickname != "" {
		memoMessage.CreatorName = user.Nickname
	} else {
		memoMessage.CreatorName = user.Username
	}
	memoMessage.CreatorUsername = user.Username

	// Compose display ts.
	memoMessage.DisplayTs = memoMessage.CreatedTs
	// Find memo display with updated ts setting.
	memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return nil, err
	}
	if memoDisplayWithUpdatedTs {
		memoMessage.DisplayTs = memoMessage.UpdatedTs
	}

	// Compose related resources.
	resourceList, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to list resources")
	}
	memoMessage.ResourceList = []*Resource{}
	for _, resource := range resourceList {
		memoMessage.ResourceList = append(memoMessage.ResourceList, convertResourceFromStore(resource))
	}

	// Compose related memo relations.
	relationList := []*MemoRelation{}
	tempList, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, err
	}
	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}
	tempList, err = s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
	})
	if err != nil {
		return nil, err
	}
	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}
	memoMessage.RelationList = relationList
	return memoMessage, nil
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

func getMemoRelationListDiff(oldList, newList []*MemoRelation) (addedList, removedList []*store.MemoRelation) {
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
			removedList = append(removedList, &store.MemoRelation{
				MemoID:        relation.MemoID,
				RelatedMemoID: relation.RelatedMemoID,
				Type:          store.MemoRelationType(relation.Type),
			})
		}
	}
	for _, relation := range newList {
		key := fmt.Sprintf("%d-%s", relation.RelatedMemoID, relation.Type)
		if !oldMap[key] {
			addedList = append(addedList, &store.MemoRelation{
				MemoID:        relation.MemoID,
				RelatedMemoID: relation.RelatedMemoID,
				Type:          store.MemoRelationType(relation.Type),
			})
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

// DispatchMemoCreatedWebhook dispatches webhook when memo is created.
func (s *APIV1Service) DispatchMemoCreatedWebhook(ctx context.Context, memo *Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.created")
}

// DispatchMemoUpdatedWebhook dispatches webhook when memo is updated.
func (s *APIV1Service) DispatchMemoUpdatedWebhook(ctx context.Context, memo *Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.updated")
}

// DispatchMemoDeletedWebhook dispatches webhook when memo is deletedd.
func (s *APIV1Service) DispatchMemoDeletedWebhook(ctx context.Context, memo *Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.deleted")
}

func (s *APIV1Service) dispatchMemoRelatedWebhook(ctx context.Context, memo *Memo, activityType string) error {
	webhooks, err := s.Store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &memo.CreatorID,
	})
	if err != nil {
		return err
	}
	metric.Enqueue("webhook dispatch")
	for _, hook := range webhooks {
		payload := convertMemoToWebhookPayload(memo)
		payload.ActivityType = activityType
		payload.URL = hook.Url
		err := webhook.Post(*payload)
		if err != nil {
			return errors.Wrap(err, "failed to post webhook")
		}
	}
	return nil
}

func convertMemoToWebhookPayload(memo *Memo) *webhook.WebhookPayload {
	return &webhook.WebhookPayload{
		CreatorID: memo.CreatorID,
		CreatedTs: time.Now().Unix(),
		Memo: &webhook.Memo{
			ID:         memo.ID,
			CreatorID:  memo.CreatorID,
			CreatedTs:  memo.CreatedTs,
			UpdatedTs:  memo.UpdatedTs,
			Content:    memo.Content,
			Visibility: memo.Visibility.String(),
			Pinned:     memo.Pinned,
			ResourceList: func() []*webhook.Resource {
				resources := []*webhook.Resource{}
				for _, resource := range memo.ResourceList {
					resources = append(resources, &webhook.Resource{
						ID:           resource.ID,
						CreatorID:    resource.CreatorID,
						CreatedTs:    resource.CreatedTs,
						UpdatedTs:    resource.UpdatedTs,
						Filename:     resource.Filename,
						InternalPath: resource.InternalPath,
						ExternalLink: resource.ExternalLink,
						Type:         resource.Type,
						Size:         resource.Size,
					})
				}
				return resources
			}(),
			RelationList: func() []*webhook.MemoRelation {
				relations := []*webhook.MemoRelation{}
				for _, relation := range memo.RelationList {
					relations = append(relations, &webhook.MemoRelation{
						MemoID:        relation.MemoID,
						RelatedMemoID: relation.RelatedMemoID,
						Type:          relation.Type.String(),
					})
				}
				return relations
			}(),
		},
	}
}
