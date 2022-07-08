package api

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Privite is the PRIVATE visibility.
	Privite Visibility = "PRIVATE"
)

func (e Visibility) String() string {
	switch e {
	case Public:
		return "PUBLIC"
	case Privite:
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
}

type MemoCreate struct {
	// Standard fields
	CreatorID int
	// Used to import memos with a clearly created ts.
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`
}

type MemoPatch struct {
	ID int

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Content    *string     `json:"content"`
	Visibility *Visibility `json:"visibility"`
}

type MemoFind struct {
	ID *int `json:"id"`

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`
	CreatorID *int       `json:"creatorId"`

	// Domain specific fields
	Pinned        *bool
	ContentSearch *string
	Visibility    *Visibility

	// Pagination
	Limit  int
	Offset int
}

type MemoDelete struct {
	ID int `json:"id"`
}
