package v1

var authenticationAllowlistMethods = map[string]bool{
	"/memos.api.v1.WorkspaceService/GetWorkspaceProfile":          true,
	"/memos.api.v1.WorkspaceSettingService/GetWorkspaceSetting":   true,
	"/memos.api.v1.WorkspaceSettingService/ListWorkspaceSettings": true,
	"/memos.api.v1.IdentityProviderService/GetIdentityProvider":   true,
	"/memos.api.v1.IdentityProviderService/ListIdentityProviders": true,
	"/memos.api.v1.AuthService/GetAuthStatus":                     true,
	"/memos.api.v1.AuthService/SignIn":                            true,
	"/memos.api.v1.AuthService/SignInWithSSO":                     true,
	"/memos.api.v1.AuthService/SignOut":                           true,
	"/memos.api.v1.AuthService/SignUp":                            true,
	"/memos.api.v1.UserService/GetUser":                           true,
	"/memos.api.v1.UserService/GetUserAvatarBinary":               true,
	"/memos.api.v1.UserService/SearchUsers":                       true,
	"/memos.api.v1.MemoService/GetMemo":                           true,
	"/memos.api.v1.MemoService/ListMemos":                         true,
	"/memos.api.v1.MemoService/ListMemoTags":                      true,
	"/memos.api.v1.MemoService/SearchMemos":                       true,
	"/memos.api.v1.MarkdownService/GetLinkMetadata":               true,
	"/memos.api.v1.ResourceService/GetResourceBinary":             true,
}

// isUnauthorizeAllowedMethod returns whether the method is exempted from authentication.
func isUnauthorizeAllowedMethod(fullMethodName string) bool {
	return authenticationAllowlistMethods[fullMethodName]
}

var allowedMethodsOnlyForAdmin = map[string]bool{
	"/memos.api.v1.UserService/CreateUser":                      true,
	"/memos.api.v1.WorkspaceSettingService/SetWorkspaceSetting": true,
}

// isOnlyForAdminAllowedMethod returns true if the method is allowed to be called only by admin.
func isOnlyForAdminAllowedMethod(methodName string) bool {
	return allowedMethodsOnlyForAdmin[methodName]
}
