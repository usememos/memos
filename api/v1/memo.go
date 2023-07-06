package v1

import (
	"context"
	"encoding/json"

	"github.com/pkg/errors"
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
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int       `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	DisplayTs  int64      `json:"displayTs"`
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`
	Pinned     bool       `json:"pinned"`

	// Related fields
	CreatorName  string          `json:"creatorName"`
	ResourceList []*Resource     `json:"resourceList"`
	RelationList []*MemoRelation `json:"relationList"`
}

type CreateMemoRequest struct {
	// Standard fields
	CreatorID int    `json:"-"`
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Visibility Visibility `json:"visibility"`
	Content    string     `json:"content"`

	// Related fields
	ResourceIDList []int                 `json:"resourceIdList"`
	RelationList   []*MemoRelationUpsert `json:"relationList"`
}

type PatchMemoRequest struct {
	ID int `json:"-"`

	// Standard fields
	CreatedTs *int64 `json:"createdTs"`
	UpdatedTs *int64
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Content    *string     `json:"content"`
	Visibility *Visibility `json:"visibility"`

	// Related fields
	ResourceIDList []int                 `json:"resourceIdList"`
	RelationList   []*MemoRelationUpsert `json:"relationList"`
}

type FindMemoRequest struct {
	ID *int

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int

	// Domain specific fields
	Pinned         *bool
	ContentSearch  []string
	VisibilityList []Visibility

	// Pagination
	Limit  *int
	Offset *int
}

func (s *APIV1Service) convertMemoFromStore(ctx context.Context, memoMessage *store.Memo) (*Memo, error) {
	memoResponse := &Memo{
		ID:         memoMessage.ID,
		RowStatus:  RowStatus(memoMessage.RowStatus.String()),
		CreatorID:  memoMessage.CreatorID,
		CreatedTs:  memoMessage.CreatedTs,
		UpdatedTs:  memoMessage.UpdatedTs,
		Content:    memoMessage.Content,
		Visibility: Visibility(memoMessage.Visibility.String()),
		Pinned:     memoMessage.Pinned,
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
	for _, relation := range memoMessage.RelationList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}
	memoResponse.RelationList = relationList

	resourceList := []*Resource{}
	for _, resourceID := range memoMessage.ResourceIDList {
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
