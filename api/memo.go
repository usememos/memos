package api

type Memo struct {
	ID int `json:"id"`

	// Standard fields
	CreatedTs int64  `json:"createdTs"`
	UpdatedTs int64  `json:"updatedTs"`
	RowStatus string `json:"rowStatus"`

	// Domain specific fields
	Content   string `json:"content"`
	CreatorID int    `json:"creatorId"`
}

type MemoCreate struct {
	// Standard fields
	CreatorID int
	// Used to import memos with clearly created ts.
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Content string `json:"content"`
}

type MemoPatch struct {
	ID int

	// Standard fields
	CreatedTs *int64  `json:"createdTs"`
	RowStatus *string `json:"rowStatus"`

	// Domain specific fields
	Content *string `json:"content"`
}

type MemoFind struct {
	ID *int `json:"id"`

	// Standard fields
	CreatorID *int    `json:"creatorId"`
	RowStatus *string `json:"rowStatus"`
}

type MemoDelete struct {
	ID *int `json:"id"`
}
