package api

type SignIn struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SSOSignIn struct {
	IdentityProviderID int    `json:"identityProviderId"`
	Code               string `json:"code"`
	RedirectURI        string `json:"redirectUri"`
}

type SignUp struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
