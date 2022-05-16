package api

// Role is the type of a role.
type Role string

const (
	// Owner is the OWNER role.
	Owner Role = "OWNER"
	// NormalUser is the USER role.
	NormalUser Role = "USER"
)

type User struct {
	ID int `json:"id"`

	// Standard fields
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Email        string `json:"email"`
	Role         Role   `json:"role"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"`
	OpenID       string `json:"openId"`
}

type UserCreate struct {
	// Domain specific fields
	Email        string `json:"email"`
	Role         Role   `json:"role"`
	Name         string `json:"name"`
	Password     string `json:"password"`
	PasswordHash string
	OpenID       string
}

type UserPatch struct {
	ID int

	// Domain specific fields
	Email        *string `json:"email"`
	Name         *string `json:"name"`
	Password     *string `json:"password"`
	ResetOpenID  *bool   `json:"resetOpenId"`
	PasswordHash *string
	OpenID       *string
}

type UserFind struct {
	ID *int `json:"id"`

	// Domain specific fields
	Email  *string `json:"email"`
	Role   *Role
	Name   *string `json:"name"`
	OpenID *string
}
