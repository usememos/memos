package api

type SignIn struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SignUp struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
