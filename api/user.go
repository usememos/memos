package api

type User struct {
	Id        int   `jsonapi:"primary,user"`
	CreatedTs int64 `jsonapi:"attr,createdTs"`
	UpdatedTs int64 `jsonapi:"attr,updatedTs"`

	OpenId   string `jsonapi:"attr,openId"`
	Name     string `jsonapi:"attr,name"`
	Password string
}

type UserCreate struct {
	OpenId   string `jsonapi:"attr,openId"`
	Name     string `jsonapi:"attr,name"`
	Password string `jsonapi:"attr,password"`
}

type UserPatch struct {
	Id int

	OpenId *string

	Name        *string `jsonapi:"attr,name"`
	Password    *string `jsonapi:"attr,password"`
	ResetOpenId *bool   `jsonapi:"attr,resetOpenId"`
}

type UserFind struct {
	Id *int `jsonapi:"attr,id"`

	Name   *string `jsonapi:"attr,name"`
	OpenId *string
}

type UserService interface {
	CreateUser(create *UserCreate) (*User, error)
	PatchUser(patch *UserPatch) (*User, error)
	FindUser(find *UserFind) (*User, error)
}
