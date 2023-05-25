package api

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

type MemoResponse struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int       `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`
	Pinned     bool       `json:"pinned"`

	// Related fields
	CreatorName    string `json:"creatorName"`
	ResourceIDList []int
	ResourceList   []*Resource     `json:"resourceList"`
	RelationList   []*MemoRelation `json:"relationList"`
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
	ContentSearch  *string
	VisibilityList []Visibility

	// Pagination
	Limit  *int
	Offset *int
}
