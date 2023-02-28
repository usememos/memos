package api

import (
	"fmt"

	"github.com/usememos/memos/common"
)

// Role is the type of a role.
type Role string

const (
	// Host is the HOST role.
	Host Role = "HOST"
	// Admin is the ADMIN role.
	Admin Role = "ADMIN"
	// NormalUser is the USER role.
	NormalUser Role = "USER"
)

func (e Role) String() string {
	switch e {
	case Host:
		return "HOST"
	case Admin:
		return "ADMIN"
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
	Username        string         `json:"username"`
	Role            Role           `json:"role"`
	Email           string         `json:"email"`
	Nickname        string         `json:"nickname"`
	PasswordHash    string         `json:"-"`
	OpenID          string         `json:"openId"`
	AvatarURL       string         `json:"avatarUrl"`
	UserSettingList []*UserSetting `json:"userSettingList"`
}

type UserCreate struct {
	// Domain specific fields
	Username     string `json:"username"`
	Role         Role   `json:"role"`
	Email        string `json:"email"`
	Nickname     string `json:"nickname"`
	Password     string `json:"password"`
	PasswordHash string
	OpenID       string
}

func (create UserCreate) Validate() error {
	if len(create.Username) < 3 {
		return fmt.Errorf("username is too short, minimum length is 3")
	}
	if len(create.Username) > 32 {
		return fmt.Errorf("username is too long, maximum length is 32")
	}
	if len(create.Password) < 3 {
		return fmt.Errorf("password is too short, minimum length is 6")
	}
	if len(create.Password) > 512 {
		return fmt.Errorf("password is too long, maximum length is 512")
	}
	if len(create.Nickname) > 64 {
		return fmt.Errorf("nickname is too long, maximum length is 64")
	}
	if create.Email != "" {
		if len(create.Email) > 256 {
			return fmt.Errorf("email is too long, maximum length is 256")
		}
		if !common.ValidateEmail(create.Email) {
			return fmt.Errorf("invalid email format")
		}
	}

	return nil
}

type UserPatch struct {
	ID int `json:"-"`

	// Standard fields
	UpdatedTs *int64
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Username     *string `json:"username"`
	Email        *string `json:"email"`
	Nickname     *string `json:"nickname"`
	Password     *string `json:"password"`
	ResetOpenID  *bool   `json:"resetOpenId"`
	AvatarURL    *string `json:"avatarUrl"`
	PasswordHash *string
	OpenID       *string
}

func (patch UserPatch) Validate() error {
	if patch.Username != nil && len(*patch.Username) < 3 {
		return fmt.Errorf("username is too short, minimum length is 3")
	}
	if patch.Username != nil && len(*patch.Username) > 32 {
		return fmt.Errorf("username is too long, maximum length is 32")
	}
	if len(*patch.Password) < 3 {
		return fmt.Errorf("password is too short, minimum length is 6")
	}
	if len(*patch.Password) > 512 {
		return fmt.Errorf("password is too long, maximum length is 512")
	}
	if patch.Nickname != nil && len(*patch.Nickname) > 64 {
		return fmt.Errorf("nickname is too long, maximum length is 64")
	}
	if patch.AvatarURL != nil {
		if len(*patch.AvatarURL) > 2<<20 {
			return fmt.Errorf("avatar is too large, maximum is 2MB")
		}
	}
	if patch.Email != nil && *patch.Email != "" {
		if len(*patch.Email) > 256 {
			return fmt.Errorf("email is too long, maximum length is 256")
		}
		if !common.ValidateEmail(*patch.Email) {
			return fmt.Errorf("invalid email format")
		}
	}

	return nil
}

type UserFind struct {
	ID *int `json:"id"`

	// Standard fields
	RowStatus *RowStatus `json:"rowStatus"`

	// Domain specific fields
	Username *string `json:"username"`
	Role     *Role
	Email    *string `json:"email"`
	Nickname *string `json:"nickname"`
	OpenID   *string
}

type UserDelete struct {
	ID int
}
