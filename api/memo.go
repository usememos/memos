package api

// MaxContentLength means the max memo content bytes is 1MB.
const MaxContentLength = 1 << 30

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

func (e Visibility) String() string {
	switch e {
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
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`
	Pinned     bool       `json:"pinned"`

	// Related fields
	CreatorName  string          `json:"creatorName"`
	ResourceList []*Resource     `json:"resourceList"`
	RelationList []*MemoRelation `json:"relationList"`
}

type MemoCreate struct {
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

type MemoPatch struct {
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

type MemoFind struct {
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

type MemoDelete struct {
	ID int
}
