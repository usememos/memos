package api

type Memo struct {
	Id        int    `json:"id"`
	CreatedTs int64  `json:"createdTs"`
	UpdatedTs int64  `json:"updatedTs"`
	RowStatus string `json:"rowStatus"`

	Content   string `json:"content"`
	CreatorId int    `json:"creatorId"`
}

type MemoCreate struct {
	CreatorId int

	Content string `json:"content"`
}

type MemoPatch struct {
	Id int

	Content   *string `json:"content"`
	RowStatus *string `json:"rowStatus"`
}

type MemoFind struct {
	Id        *int    `json:"id"`
	CreatorId *int    `json:"creatorId"`
	RowStatus *string `json:"rowStatus"`
}

type MemoDelete struct {
	Id *int `json:"id"`
}

type MemoService interface {
	CreateMemo(create *MemoCreate) (*Memo, error)
	PatchMemo(patch *MemoPatch) (*Memo, error)
	FindMemoList(find *MemoFind) ([]*Memo, error)
	FindMemo(find *MemoFind) (*Memo, error)
	DeleteMemo(delete *MemoDelete) error
}
