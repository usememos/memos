package api

type Memo struct {
	ID        int    `json:"id"`
	CreatedTs int64  `json:"createdTs"`
	UpdatedTs int64  `json:"updatedTs"`
	RowStatus string `json:"rowStatus"`

	Content   string `json:"content"`
	CreatorID int    `json:"creatorId"`
}

type MemoCreate struct {
	CreatorID int

	Content string `json:"content"`
}

type MemoPatch struct {
	ID int

	Content   *string `json:"content"`
	RowStatus *string `json:"rowStatus"`
	CreatedTs *int64  `json:"createdTs"`
}

type MemoFind struct {
	ID        *int    `json:"id"`
	CreatorID *int    `json:"creatorId"`
	RowStatus *string `json:"rowStatus"`
}

type MemoDelete struct {
	ID *int `json:"id"`
}

type MemoService interface {
	CreateMemo(create *MemoCreate) (*Memo, error)
	PatchMemo(patch *MemoPatch) (*Memo, error)
	FindMemoList(find *MemoFind) ([]*Memo, error)
	FindMemo(find *MemoFind) (*Memo, error)
	DeleteMemo(delete *MemoDelete) error
}
