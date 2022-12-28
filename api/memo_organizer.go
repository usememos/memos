package api

type MemoOrganizer struct {
	ID int

	// Domain specific fields
	MemoID int
	UserID int
	Pinned bool
}

type MemoOrganizerUpsert struct {
	MemoID int  `json:"-"`
	UserID int  `json:"-"`
	Pinned bool `json:"pinned"`
}

type MemoOrganizerFind struct {
	MemoID int
	UserID int
}

type MemoOrganizerDelete struct {
	MemoID *int
	UserID *int
}
