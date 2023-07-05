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
	InternalPath string `json:"-"`
	ExternalLink string `json:"externalLink"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	PublicID     string `json:"publicId"`

	// Related fields
	LinkedMemoAmount int `json:"linkedMemoAmount"`
}
