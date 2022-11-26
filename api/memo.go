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
	DisplayTs  int64      `json:"displayTs"`

	// Related fields
	Creator      *User       `json:"creator"`
	ResourceList []*Resource `json:"resourceList"`
}

type MemoCreate struct {
	// Standard fields
	CreatorID int

	// Domain specific fields
	Visibility Visibility `json:"visibility"`
	Content    string     `json:"content"`

	// Related fields
	ResourceIDList []int `json:"resourceIdList"`
}

type MemoPatch struct {
	ID int

	// Standard fields
	CreatedTs *int64 `json:"createdTs"`
	UpdatedTs *int64
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Content    *string     `json:"content"`
	Visibility *Visibility `json:"visibility"`

	// Related fields
	ResourceIDList []int `json:"resourceIdList"`
}

type MemoFind struct {
	ID *int `json:"id"`

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`
	CreatorID *int       `json:"creatorId"`

	// Domain specific fields
	Pinned         *bool
	ContentSearch  *string
	VisibilityList []Visibility

	// Pagination
	Limit  int
	Offset int
}

type MemoDelete struct {
	ID int
}
