package v1

// PublicMethods defines API endpoints that don't require authentication.
// All other endpoints require a valid session or access token.
//
// This is the SINGLE SOURCE OF TRUTH for public endpoints.
// Both Connect interceptor and gRPC-Gateway interceptor use this map.
//
// Format: Full gRPC procedure path as returned by req.Spec().Procedure (Connect)
// or info.FullMethod (gRPC interceptor).
var PublicMethods = map[string]struct{}{
	// Auth Service - login/token endpoints must be accessible without auth
	"/memos.api.v1.AuthService/SignIn":       {},
	"/memos.api.v1.AuthService/RefreshToken": {}, // Token refresh uses cookie, must be accessible when access token expired

	// Instance Service - needed before login to show instance info
	"/memos.api.v1.InstanceService/GetInstanceProfile":       {},
	"/memos.api.v1.InstanceService/GetInstanceSetting":       {},
	"/memos.api.v1.InstanceService/BatchGetInstanceSettings": {},

	// User Service - public user profiles and stats
	"/memos.api.v1.UserService/CreateUser":       {}, // Registration policy is enforced in UserService
	"/memos.api.v1.UserService/GetUser":          {},
	"/memos.api.v1.UserService/BatchGetUsers":    {},
	"/memos.api.v1.UserService/GetUserAvatar":    {},
	"/memos.api.v1.UserService/GetUserStats":     {},
	"/memos.api.v1.UserService/ListAllUserStats": {},

	// Identity Provider Service - SSO buttons on login page
	"/memos.api.v1.IdentityProviderService/ListIdentityProviders": {},

	// Memo Service - public memos (visibility filtering done in service layer)
	"/memos.api.v1.MemoService/GetMemo":              {},
	"/memos.api.v1.MemoService/ListMemos":            {},
	"/memos.api.v1.MemoService/ListMemoComments":     {},
	"/memos.api.v1.MemoService/GetLinkMetadata":      {},
	"/memos.api.v1.MemoService/BatchGetLinkMetadata": {},

	// Memo sharing - share-token endpoints require no authentication
	"/memos.api.v1.MemoService/GetMemoByShare": {},
}

// IsPublicMethod checks if a procedure path is public (no authentication required).
// Returns true for public methods, false for protected methods.
func IsPublicMethod(procedure string) bool {
	_, ok := PublicMethods[procedure]
	return ok
}

// AuthBootstrapMethods is the subset of PublicMethods that stays reachable by
// anonymous callers even when the instance is private (no InstanceURL configured).
//
// It is the minimum required to render the sign-in page, authenticate, and follow
// share links, and register when instance settings permit it. Every entry here
// MUST also exist in PublicMethods.
var AuthBootstrapMethods = map[string]struct{}{
	// Auth Service - sign-in and token refresh.
	"/memos.api.v1.AuthService/SignIn":       {},
	"/memos.api.v1.AuthService/RefreshToken": {},

	// Instance Service - needed to render the sign-in page (branding, auth options).
	"/memos.api.v1.InstanceService/GetInstanceProfile":       {},
	"/memos.api.v1.InstanceService/GetInstanceSetting":       {},
	"/memos.api.v1.InstanceService/BatchGetInstanceSettings": {},

	// Identity Provider Service - SSO buttons on the sign-in page.
	"/memos.api.v1.IdentityProviderService/ListIdentityProviders": {},

	// User Service - CreateUser applies registration and password-auth settings.
	"/memos.api.v1.UserService/CreateUser": {},

	// Memo sharing - share-token access stays public even on a private instance.
	"/memos.api.v1.MemoService/GetMemoByShare": {},
}

// IsAuthBootstrapMethod reports whether an anonymous request to procedure is one
// of the fixed endpoints allowed while the instance is private.
func IsAuthBootstrapMethod(procedure string) bool {
	_, ok := AuthBootstrapMethods[procedure]
	return ok
}
