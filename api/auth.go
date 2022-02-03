package api

type Login struct {
	Name     string `jsonapi:"attr,name"`
	Password string `jsonapi:"attr,password"`
}

type Signup struct {
	Name     string `jsonapi:"attr,name"`
	Password string `jsonapi:"attr,password"`
}
