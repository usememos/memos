package api

type Shortcut struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatorID int       `json:"creatorId"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

	// Domain specific fields
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type ShortcutCreate struct {
	// Standard fields
	CreatorID int `json:"-"`

	// Domain specific fields
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type ShortcutPatch struct {
	ID int `json:"-"`

	// Standard fields
	UpdatedTs *int64
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Title   *string `json:"title"`
	Payload *string `json:"payload"`
}

type ShortcutFind struct {
	ID *int

	// Standard fields
	CreatorID *int

	// Domain specific fields
	Title *string `json:"title"`
}

type ShortcutDelete struct {
	ID *int

	// Standard fields
	CreatorID *int
}
