package api

type Resource struct {
	ID        int   `json:"id"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	Filename string `json:"filename"`
	Blob     []byte `json:"blob"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`

	CreatorID int `json:"creatorId"`
}

type ResourceCreate struct {
	Filename string `json:"filename"`
	Blob     []byte `json:"blob"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`

	CreatorID int
}

type ResourceFind struct {
	ID        *int    `json:"id"`
	CreatorID *int    `json:"creatorId"`
	Filename  *string `json:"filename"`
}

type ResourceDelete struct {
	ID int
}

type ResourceService interface {
	CreateResource(create *ResourceCreate) (*Resource, error)
	FindResourceList(find *ResourceFind) ([]*Resource, error)
	FindResource(find *ResourceFind) (*Resource, error)
	DeleteResource(delete *ResourceDelete) error
}
