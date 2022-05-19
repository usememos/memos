package api

type MemoOrganizer struct {
	ID int

	// Domain specific fields
	MemoID int
	UserID int
	Pinned bool
}

type MemoOrganizerFind struct {
	MemoID int
	UserID int
}

type MemoOrganizerUpsert struct {
	MemoID int
	UserID int
	Pinned bool `json:"pinned"`
}
