package api

type MemoHistory struct {
	ID int `json:"id"`

	MemoID    int
	CreatedTs int64

	// Domain specific fields
	Content string `json:"content"`
}

type MemoHistoryCreate struct {
	MemoID int

	Content *string `json:"content"`
}

type MemoHistoryFind struct {
	ID     *int
	MemoID *int
}

type MemoHistoryDelete struct {
	ID int
}
