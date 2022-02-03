package api

type Resource struct {
	Id        int   `jsonapi:"primary,resource"`
	CreatedTs int64 `jsonapi:"attr,createdTs"`
	UpdatedTs int64 `jsonapi:"attr,updatedTs"`

	Filename string `jsonapi:"attr,filename"`
	Blob     []byte `jsonapi:"attr,blob"`
	Type     string `jsonapi:"attr,type"`
	Size     int64  `jsonapi:"attr,size"`

	CreatorId int `jsonapi:"attr,creatorId"`
}

type ResourceCreate struct {
	Filename string `jsonapi:"attr,filename"`
	Blob     []byte `jsonapi:"attr,blob"`
	Type     string `jsonapi:"attr,type"`
	Size     int64  `jsonapi:"attr,size"`

	CreatorId int `jsonapi:"attr,creatorId"`
}

type ResourceFind struct {
	Id        *int
	CreatorId *int
	Filename  *string
}

type ResourceDelete struct {
	Id int
}

type ResourceService interface {
	CreateResource(create *ResourceCreate) (*Resource, error)
	FindResourceList(find *ResourceFind) ([]*Resource, error)
	FindResource(find *ResourceFind) (*Resource, error)
	DeleteResource(delete *ResourceDelete) error
}
