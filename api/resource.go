package api

type Resource struct {
	ID int `json:"id"`

	// Standard fields
	CreatorID int   `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Filename string `json:"filename"`
	Blob     []byte `json:"-"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`

	// Related fields
	LinkedMemoAmount int `json:"linkedMemoAmount"`
}

type ResourceCreate struct {
	// Standard fields
	CreatorID int

	// Domain specific fields
	Filename string `json:"filename"`
	Blob     []byte `json:"blob"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
}

type ResourceFind struct {
	ID *int `json:"id"`

	// Standard fields
	CreatorID *int `json:"creatorId"`

	// Domain specific fields
	Filename *string `json:"filename"`
	MemoID   *int
}

type ResourceDelete struct {
	ID int

	// Standard fields
	CreatorID int
}

type ResourcePatch struct {
	ID int

	// Standard fields
	UpdatedTs *int64

	Filename *string `json:"filename"`
}
