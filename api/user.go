package api

// Role is the type of a role.
type Role string

const (
	// Host is the HOST role.
	Host Role = "HOST"
	// NormalUser is the USER role.
	NormalUser Role = "USER"
)

func (e Role) String() string {
	switch e {
	case Host:
		return "HOST"
	case NormalUser:
		return "USER"
	}
	return "USER"
}

type User struct {
	ID int `json:"id"`

	// Standard fields
	RowStatus RowStatus `json:"rowStatus"`
	CreatedTs int64     `json:"createdTs"`
	UpdatedTs int64     `json:"updatedTs"`

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

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`

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

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Email  *string `json:"email"`
	Role   *Role
	Name   *string `json:"name"`
	OpenID *string
}

type UserDelete struct {
	ID int
}
