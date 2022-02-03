package api

type Memo struct {
	Id        int    `jsonapi:"primary,memo"`
	CreatedTs int64  `jsonapi:"attr,createdTs"`
	UpdatedTs int64  `jsonapi:"attr,updatedTs"`
	RowStatus string `jsonapi:"attr,rowStatus"`

	Content   string `jsonapi:"attr,content"`
	CreatorId int    `jsonapi:"attr,creatorId"`
}

type MemoCreate struct {
	Content   string `jsonapi:"attr,content"`
	CreatorId int
}

type MemoPatch struct {
	Id int

	Content   *string
	RowStatus *string
}

type MemoFind struct {
	Id        *int
	CreatorId *int
}

type MemoDelete struct {
	Id        *int `jsonapi:"primary,memo"`
	CreatorId *int
}

type MemoService interface {
	CreateMemo(create *MemoCreate) (*Memo, error)
	PatchMemo(patch *MemoPatch) (*Memo, error)
	FindMemoList(find *MemoFind) ([]*Memo, error)
	FindMemo(find *MemoFind) (*Memo, error)
	DeleteMemo(delete *MemoDelete) error
}
