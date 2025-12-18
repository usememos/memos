package v1

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestPublicMethodsArePublic verifies that methods in PublicMethods are recognized as public.
func TestPublicMethodsArePublic(t *testing.T) {
	publicMethods := []string{
		// Auth Service
		"/memos.api.v1.AuthService/SignIn",
		"/memos.api.v1.AuthService/RefreshToken",
		// Instance Service
		"/memos.api.v1.InstanceService/GetInstanceProfile",
		"/memos.api.v1.InstanceService/GetInstanceSetting",
		// User Service
		"/memos.api.v1.UserService/CreateUser",
		"/memos.api.v1.UserService/GetUser",
		"/memos.api.v1.UserService/GetUserAvatar",
		"/memos.api.v1.UserService/GetUserStats",
		"/memos.api.v1.UserService/ListAllUserStats",
		"/memos.api.v1.UserService/SearchUsers",
		// Identity Provider Service
		"/memos.api.v1.IdentityProviderService/ListIdentityProviders",
		// Memo Service
		"/memos.api.v1.MemoService/GetMemo",
		"/memos.api.v1.MemoService/ListMemos",
	}

	for _, method := range publicMethods {
		t.Run(method, func(t *testing.T) {
			assert.True(t, IsPublicMethod(method), "Expected %s to be public", method)
		})
	}
}

// TestProtectedMethodsRequireAuth verifies that non-public methods are recognized as protected.
func TestProtectedMethodsRequireAuth(t *testing.T) {
	protectedMethods := []string{
		// Auth Service - logout and get current user require auth
		"/memos.api.v1.AuthService/SignOut",
		"/memos.api.v1.AuthService/GetCurrentUser",
		// Instance Service - admin operations
		"/memos.api.v1.InstanceService/UpdateInstanceSetting",
		// User Service - modification operations
		"/memos.api.v1.UserService/ListUsers",
		"/memos.api.v1.UserService/UpdateUser",
		"/memos.api.v1.UserService/DeleteUser",
		// Memo Service - write operations
		"/memos.api.v1.MemoService/CreateMemo",
		"/memos.api.v1.MemoService/UpdateMemo",
		"/memos.api.v1.MemoService/DeleteMemo",
		// Attachment Service - write operations
		"/memos.api.v1.AttachmentService/CreateAttachment",
		"/memos.api.v1.AttachmentService/DeleteAttachment",
		// Shortcut Service
		"/memos.api.v1.ShortcutService/CreateShortcut",
		"/memos.api.v1.ShortcutService/ListShortcuts",
		"/memos.api.v1.ShortcutService/UpdateShortcut",
		"/memos.api.v1.ShortcutService/DeleteShortcut",
		// Activity Service
		"/memos.api.v1.ActivityService/GetActivity",
	}

	for _, method := range protectedMethods {
		t.Run(method, func(t *testing.T) {
			assert.False(t, IsPublicMethod(method), "Expected %s to require auth", method)
		})
	}
}

// TestUnknownMethodsRequireAuth verifies that unknown methods default to requiring auth.
func TestUnknownMethodsRequireAuth(t *testing.T) {
	unknownMethods := []string{
		"/unknown.Service/Method",
		"/memos.api.v1.UnknownService/Method",
		"",
		"invalid",
	}

	for _, method := range unknownMethods {
		t.Run(method, func(t *testing.T) {
			assert.False(t, IsPublicMethod(method), "Unknown method %q should require auth", method)
		})
	}
}
