package api

type Shortcut struct {
	ID int `json:"id"`

	// Standard fields
	CreatorID int
	CreatedTs int64  `json:"createdTs"`
	UpdatedTs int64  `json:"updatedTs"`
	RowStatus string `json:"rowStatus"`

	// Domain specific fields
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type ShortcutCreate struct {
	// Standard fields
	CreatorID int

	// Domain specific fields
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type ShortcutPatch struct {
	ID int

	// Standard fields
	RowStatus *string `json:"rowStatus"`

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
	ID int
}

type ShortcutService interface {
	CreateShortcut(create *ShortcutCreate) (*Shortcut, error)
	PatchShortcut(patch *ShortcutPatch) (*Shortcut, error)
	FindShortcutList(find *ShortcutFind) ([]*Shortcut, error)
	FindShortcut(find *ShortcutFind) (*Shortcut, error)
	DeleteShortcut(delete *ShortcutDelete) error
}
