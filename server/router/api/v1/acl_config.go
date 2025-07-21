package v1

var authenticationAllowlistMethods = map[string]bool{
	"/memos.api.v1.WorkspaceService/GetWorkspaceProfile":          true,
	"/memos.api.v1.WorkspaceService/GetWorkspaceSetting":          true,
	"/memos.api.v1.IdentityProviderService/ListIdentityProviders": true,
	"/memos.api.v1.AuthService/CreateSession":                     true,
	"/memos.api.v1.AuthService/GetCurrentSession":                 true,
	"/memos.api.v1.UserService/CreateUser":                        true,
	"/memos.api.v1.UserService/GetUser":                           true,
	"/memos.api.v1.UserService/GetUserAvatar":                     true,
	"/memos.api.v1.UserService/GetUserStats":                      true,
	"/memos.api.v1.UserService/ListAllUserStats":                  true,
	"/memos.api.v1.UserService/SearchUsers":                       true,
	"/memos.api.v1.MemoService/GetMemo":                           true,
	"/memos.api.v1.MemoService/ListMemos":                         true,
	"/memos.api.v1.MarkdownService/GetLinkMetadata":               true,
	"/memos.api.v1.AttachmentService/GetAttachmentBinary":         true,
}

// isUnauthorizeAllowedMethod returns whether the method is exempted from authentication.
func isUnauthorizeAllowedMethod(fullMethodName string) bool {
	return authenticationAllowlistMethods[fullMethodName]
}

var allowedMethodsOnlyForAdmin = map[string]bool{
	"/memos.api.v1.UserService/CreateUser":                  true,
	"/memos.api.v1.WorkspaceService/UpdateWorkspaceSetting": true,
}

// isOnlyForAdminAllowedMethod returns true if the method is allowed to be called only by admin.
func isOnlyForAdminAllowedMethod(methodName string) bool {
	return allowedMethodsOnlyForAdmin[methodName]
}
