package v2

var authenticationAllowlistMethods = map[string]bool{
	"/memos.api.v2.WorkspaceService/GetWorkspaceProfile":          true,
	"/memos.api.v2.WorkspaceSettingService/GetWorkspaceSetting":   true,
	"/memos.api.v2.WorkspaceSettingService/ListWorkspaceSettings": true,
	"/memos.api.v2.AuthService/GetAuthStatus":                     true,
	"/memos.api.v2.AuthService/SignIn":                            true,
	"/memos.api.v2.AuthService/SignInWithSSO":                     true,
	"/memos.api.v2.AuthService/SignOut":                           true,
	"/memos.api.v2.AuthService/SignUp":                            true,
	"/memos.api.v2.UserService/GetUser":                           true,
	"/memos.api.v2.UserService/SearchUsers":                       true,
	"/memos.api.v2.MemoService/ListMemos":                         true,
	"/memos.api.v2.MemoService/GetMemo":                           true,
	"/memos.api.v2.MemoService/SearchMemos":                       true,
	"/memos.api.v2.MemoService/ListMemoResources":                 true,
	"/memos.api.v2.MemoService/ListMemoRelations":                 true,
	"/memos.api.v2.MemoService/ListMemoComments":                  true,
	"/memos.api.v2.LinkService/GetLinkMetadata":                   true,
}

// isUnauthorizeAllowedMethod returns whether the method is exempted from authentication.
func isUnauthorizeAllowedMethod(fullMethodName string) bool {
	return authenticationAllowlistMethods[fullMethodName]
}

var allowedMethodsOnlyForAdmin = map[string]bool{
	"/memos.api.v2.UserService/CreateUser": true,
}

// isOnlyForAdminAllowedMethod returns true if the method is allowed to be called only by admin.
func isOnlyForAdminAllowedMethod(methodName string) bool {
	return allowedMethodsOnlyForAdmin[methodName]
}
