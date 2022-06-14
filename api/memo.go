package api

type Memo struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int       `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	Content string `json:"content"`
	Pinned  bool   `json:"pinned"`
}

type MemoCreate struct {
	// Standard fields
	CreatorID int
	// Used to import memos with a clearly created ts.
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Content string `json:"content"`
}

type MemoPatch struct {
	ID int

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Content *string `json:"content"`
}

type MemoFind struct {
	ID *int `json:"id"`

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`
	CreatorID *int       `json:"creatorId"`

	// Domain specific fields
	Pinned *bool
	Tag    *string
}

type MemoDelete struct {
	ID int `json:"id"`
}
