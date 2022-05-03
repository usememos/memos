package api

type User struct {
	ID int `json:"id"`

	// Standard fields
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	OpenID       string `json:"openId"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"`
}

type UserCreate struct {
	// Domain specific fields
	OpenID       string
	Name         string
	PasswordHash string
}

type UserPatch struct {
	ID int

	// Domain specific fields
	OpenID       *string
	PasswordHash *string
	Name         *string `json:"name"`
	Password     *string `json:"password"`
	ResetOpenID  *bool   `json:"resetOpenId"`
}

type UserFind struct {
	ID *int `json:"id"`

	// Domain specific fields
	Name   *string `json:"name"`
	OpenID *string
}

type UserRenameCheck struct {
	Name string `json:"name"`
}

type UserPasswordCheck struct {
	Password string `json:"password"`
}

type UserService interface {
	CreateUser(create *UserCreate) (*User, error)
	PatchUser(patch *UserPatch) (*User, error)
	FindUser(find *UserFind) (*User, error)
}
