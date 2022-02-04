package api

type Login struct {
	Name     string `json:"name"`
	Password string `json:"password"`
}

type Signup struct {
	Name     string `json:"name"`
	Password string `json:"password"`
}
