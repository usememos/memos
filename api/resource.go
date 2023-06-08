package api

type Resource struct {
	ID int `json:"id"`

	// Standard fields
	CreatorID int   `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Filename     string `json:"filename"`
	Blob         []byte `json:"-"`
	InternalPath string `json:"internalPath"`
	ExternalLink string `json:"externalLink"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	PublicID     string `json:"publicId"`

	// Related fields
	LinkedMemoAmount int `json:"linkedMemoAmount"`
}

type ResourceCreate struct {
	// Standard fields
	CreatorID int `json:"-"`

	// Domain specific fields
	Filename        string `json:"filename"`
	Blob            []byte `json:"-"`
	InternalPath    string `json:"internalPath"`
	ExternalLink    string `json:"externalLink"`
	Type            string `json:"type"`
	Size            int64  `json:"-"`
	PublicID        string `json:"publicId"`
	DownloadToLocal bool   `json:"downloadToLocal"`
}

type ResourceFind struct {
	ID *int `json:"id"`

	// Standard fields
	CreatorID *int `json:"creatorId"`

	// Domain specific fields
	Filename *string `json:"filename"`
	MemoID   *int
	PublicID *string `json:"publicId"`
	GetBlob  bool

	// Pagination
	Limit  *int
	Offset *int
}

type ResourcePatch struct {
	ID int `json:"-"`

	// Standard fields
	UpdatedTs *int64

	// Domain specific fields
	Filename      *string `json:"filename"`
	ResetPublicID *bool   `json:"resetPublicId"`
	PublicID      *string `json:"-"`
}

type ResourceDelete struct {
	ID int
}
