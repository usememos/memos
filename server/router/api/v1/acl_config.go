package v1

// Access Control List (ACL) Configuration
//
// This file defines which API methods require authentication and which require admin privileges.
// Used by both gRPC and Connect interceptors to enforce access control.
//
// Method names follow the gRPC full method format: "/{package}.{service}/{method}"
// Example: "/memos.api.v1.MemoService/CreateMemo"

// publicMethods lists methods that can be called without authentication.
// These are typically read-only endpoints for public content or login-related endpoints.
var publicMethods = map[string]bool{
	// Instance info - needed before login
	"/memos.api.v1.InstanceService/GetInstanceProfile": true,
	"/memos.api.v1.InstanceService/GetInstanceSetting": true,

	// Auth - login/session endpoints
	"/memos.api.v1.AuthService/CreateSession":     true,
	"/memos.api.v1.AuthService/GetCurrentSession": true,

	// User - public user info and registration
	"/memos.api.v1.UserService/CreateUser":       true, // Registration (also admin-only when not first user)
	"/memos.api.v1.UserService/GetUser":          true,
	"/memos.api.v1.UserService/GetUserAvatar":    true,
	"/memos.api.v1.UserService/GetUserStats":     true,
	"/memos.api.v1.UserService/ListAllUserStats": true,
	"/memos.api.v1.UserService/SearchUsers":      true,

	// Identity providers - needed for SSO login
	"/memos.api.v1.IdentityProviderService/ListIdentityProviders": true,

	// Memo - public memo access
	"/memos.api.v1.MemoService/GetMemo":   true,
	"/memos.api.v1.MemoService/ListMemos": true,

	// Attachment - public attachment access
	"/memos.api.v1.AttachmentService/GetAttachmentBinary": true,
}

// adminOnlyMethods lists methods that require admin (Host or Admin role) privileges.
// Regular users cannot call these methods even if authenticated.
var adminOnlyMethods = map[string]bool{
	"/memos.api.v1.UserService/CreateUser":                true, // Admin creates users (except first user registration)
	"/memos.api.v1.InstanceService/UpdateInstanceSetting": true,
}

// IsPublicMethod returns true if the method can be called without authentication.
func IsPublicMethod(fullMethodName string) bool {
	return publicMethods[fullMethodName]
}

// IsAdminOnlyMethod returns true if the method requires admin privileges.
func IsAdminOnlyMethod(fullMethodName string) bool {
	return adminOnlyMethods[fullMethodName]
}
