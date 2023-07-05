package api

type CreateMemoCommentRequest struct {
	// Standard fields
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Content string `json:"content"`

	// Info fields
	Email   string `json:"email"`
	Website string `json:"website"`
	Name    string `json:"name"`

	MemoID   int `json:"memoId"`
	ParentID int `json:"parentId"`
}

type MemoCommentResponse struct {
	ID int `json:"id"`

	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	DisplayTs  int64      `json:"displayTs"`
	Content    string     `json:"content"`
	Visibility Visibility `json:"visibility"`

	// Related fields
	CreatorName string `json:"creatorName"`

	// Info fields
	Email   string `json:"email"`
	Website string `json:"website"`
	Name    string `json:"name"`

	MemoID   int `json:"memo_id"`
	ParentID int `json:"parent_id"`
}
