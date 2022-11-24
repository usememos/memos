package api

type Signin struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Signup struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     Role   `json:"role"`
}
