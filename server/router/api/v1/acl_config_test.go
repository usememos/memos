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
		"/memos.api.v1.InstanceService/BatchGetInstanceSettings",
		// User Service
		"/memos.api.v1.UserService/CreateUser",
		"/memos.api.v1.UserService/GetUser",
		"/memos.api.v1.UserService/BatchGetUsers",
		"/memos.api.v1.UserService/GetUserAvatar",
		"/memos.api.v1.UserService/GetUserStats",
		"/memos.api.v1.UserService/ListAllUserStats",
		// Identity Provider Service
		"/memos.api.v1.IdentityProviderService/ListIdentityProviders",
		// Memo Service
		"/memos.api.v1.MemoService/GetMemo",
		"/memos.api.v1.MemoService/ListMemos",
		"/memos.api.v1.MemoService/ListMemoComments",
		"/memos.api.v1.MemoService/ListMemoAttachments",
		"/memos.api.v1.MemoService/ListMemoReactions",
		"/memos.api.v1.MemoService/ListMemoRelations",
		"/memos.api.v1.MemoService/GetLinkMetadata",
		"/memos.api.v1.MemoService/BatchGetLinkMetadata",
		// Attachment Service metadata follows linked memo visibility.
		"/memos.api.v1.AttachmentService/GetAttachment",
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
		"/memos.api.v1.InstanceService/TestInstanceEmailSetting",
		// User Service - modification operations
		"/memos.api.v1.UserService/ListUsers",
		"/memos.api.v1.UserService/UpdateUser",
		"/memos.api.v1.UserService/DeleteUser",
		// Memo Service - write operations
		"/memos.api.v1.MemoService/CreateMemo",
		"/memos.api.v1.MemoService/UpdateMemo",
		"/memos.api.v1.MemoService/DeleteMemo",
		// Space Service - every operation requires an authenticated member.
		"/memos.api.v1.SpaceService/CreateSpace",
		"/memos.api.v1.SpaceService/ListSpaces",
		"/memos.api.v1.SpaceService/GetSpace",
		"/memos.api.v1.SpaceService/UpdateSpace",
		"/memos.api.v1.SpaceService/DeleteSpace",
		"/memos.api.v1.SpaceService/CreateSpaceMember",
		"/memos.api.v1.SpaceService/ListSpaceMembers",
		"/memos.api.v1.SpaceService/GetSpaceMember",
		"/memos.api.v1.SpaceService/UpdateSpaceMember",
		"/memos.api.v1.SpaceService/DeleteSpaceMember",
		// Attachment Service - write operations
		"/memos.api.v1.AttachmentService/CreateAttachment",
		"/memos.api.v1.AttachmentService/DeleteAttachment",
		// Memo View Service
		"/memos.api.v1.MemoViewService/CreateMemoView",
		"/memos.api.v1.MemoViewService/GetMemoView",
		"/memos.api.v1.MemoViewService/ListMemoViews",
		"/memos.api.v1.MemoViewService/UpdateMemoView",
		"/memos.api.v1.MemoViewService/DeleteMemoView",
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

// TestAuthBootstrapMethodsAreSubsetOfPublic verifies every auth-bootstrap method is
// also a public method. A bootstrap method that wasn't public would be rejected before
// the private-instance check runs, breaking sign-in on a private instance.
func TestAuthBootstrapMethodsAreSubsetOfPublic(t *testing.T) {
	for method := range AuthBootstrapMethods {
		t.Run(method, func(t *testing.T) {
			assert.True(t, IsPublicMethod(method), "auth-bootstrap method %s must also be a public method", method)
		})
	}
}

// TestAuthBootstrapClassification verifies which endpoints remain reachable by
// anonymous callers when the instance access mode is PRIVATE.
func TestAuthBootstrapClassification(t *testing.T) {
	// Reachable while private: sign-in flow, registration, instance metadata, SSO, share links.
	bootstrap := []string{
		"/memos.api.v1.AuthService/SignIn",
		"/memos.api.v1.AuthService/RefreshToken",
		"/memos.api.v1.UserService/CreateUser",
		"/memos.api.v1.InstanceService/GetInstanceProfile",
		"/memos.api.v1.InstanceService/GetInstanceSetting",
		"/memos.api.v1.InstanceService/BatchGetInstanceSettings",
		"/memos.api.v1.IdentityProviderService/ListIdentityProviders",
		"/memos.api.v1.MemoService/GetSharedMemo",
	}
	for _, method := range bootstrap {
		t.Run("bootstrap/"+method, func(t *testing.T) {
			assert.True(t, IsAuthBootstrapMethod(method), "expected %s to be reachable on a private instance", method)
		})
	}

	// Public in PUBLIC mode, but gated in PRIVATE mode: browsing and profiles.
	gatedWhilePrivate := []string{
		"/memos.api.v1.MemoService/ListMemos",
		"/memos.api.v1.MemoService/GetMemo",
		"/memos.api.v1.MemoService/ListMemoComments",
		"/memos.api.v1.MemoService/ListMemoAttachments",
		"/memos.api.v1.MemoService/ListMemoReactions",
		"/memos.api.v1.MemoService/ListMemoRelations",
		"/memos.api.v1.AttachmentService/GetAttachment",
		"/memos.api.v1.UserService/GetUser",
		"/memos.api.v1.UserService/ListAllUserStats",
	}
	for _, method := range gatedWhilePrivate {
		t.Run("gated/"+method, func(t *testing.T) {
			assert.False(t, IsAuthBootstrapMethod(method), "expected %s to be gated on a private instance", method)
		})
	}
}
