package api

type Shortcut struct {
	Id        int   `jsonapi:"primary,shortcut"`
	CreatedTs int64 `jsonapi:"attr,createdTs"`
	UpdatedTs int64 `jsonapi:"attr,updatedTs"`

	Title     string `jsonapi:"attr,title"`
	Payload   string `jsonapi:"attr,payload"`
	PinnedTs  int64  `jsonapi:"attr,pinnedTs"`
	CreatorId int
}

type ShortcutCreate struct {
	// Standard fields
	CreatorId int

	// Domain specific fields
	Title   string `jsonapi:"attr,title"`
	Payload string `jsonapi:"attr,payload"`
}

type ShortcutPatch struct {
	Id int

	Title    *string `jsonapi:"attr,title"`
	Payload  *string `jsonapi:"attr,payload"`
	PinnedTs *int64

	Pinned *bool `jsonapi:"attr,pinned"`
}

type ShortcutFind struct {
	Id *int

	// Standard fields
	CreatorId *int

	// Domain specific fields
	Title *string `jsonapi:"attr,title"`
}

type ShortcutDelete struct {
	Id int
}

type ShortcutService interface {
	CreateShortcut(create *ShortcutCreate) (*Shortcut, error)
	PatchShortcut(patch *ShortcutPatch) (*Shortcut, error)
	FindShortcutList(find *ShortcutFind) ([]*Shortcut, error)
	FindShortcut(find *ShortcutFind) (*Shortcut, error)
	DeleteShortcut(delete *ShortcutDelete) error
}
