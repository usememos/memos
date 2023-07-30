package auth

import "strings"

var authenticationAllowlistMethods = map[string]bool{
	"/memos.api.v2.UserService/GetUser": true,
}

// IsAuthenticationAllowed returns whether the method is exempted from authentication.
func IsAuthenticationAllowed(fullMethodName string) bool {
	if strings.HasPrefix(fullMethodName, "/grpc.reflection") {
		return true
	}
	return authenticationAllowlistMethods[fullMethodName]
}
