package api

type Login struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type Signup struct {
	Email    string `json:"email"`
	Role     Role   `json:"role"`
	Name     string `json:"name"`
	Password string `json:"password"`
}
