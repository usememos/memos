package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestPublicMethodsArePublic verifies that methods in PublicMethods are recognized as public.
func TestPublicMethodsArePublic(t *testing.T) {
	publicMethods := []string{
		// Auth Service
		"/memos.api.AuthService/SignIn",
		"/memos.api.AuthService/RefreshToken",
		// Instance Service
		"/memos.api.InstanceService/GetInstanceProfile",
		"/memos.api.InstanceService/GetInstanceSetting",
		"/memos.api.InstanceService/BatchGetInstanceSettings",
		// User Service
		"/memos.api.UserService/CreateUser",
		"/memos.api.UserService/GetUser",
		"/memos.api.UserService/BatchGetUsers",
		"/memos.api.UserService/GetUserAvatar",
		"/memos.api.UserService/GetUserStats",
		"/memos.api.UserService/ListUserStats",
		// Identity Provider Service
		"/memos.api.IdentityProviderService/ListIdentityProviders",
		// Memo Service
		"/memos.api.MemoService/GetMemo",
		"/memos.api.MemoService/ListMemos",
		"/memos.api.MemoService/ListMemoComments",
		"/memos.api.MemoService/ListMemoAttachments",
		"/memos.api.MemoService/ListMemoReactions",
		"/memos.api.MemoService/ListMemoRelations",
		"/memos.api.MemoService/GetLinkMetadata",
		"/memos.api.MemoService/BatchGetLinkMetadata",
		// Attachment Service metadata follows linked memo visibility.
		"/memos.api.AttachmentService/GetAttachment",
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
		"/memos.api.AttachmentService/UploadAttachment",
		// Auth Service - logout and get current user require auth
		"/memos.api.AuthService/SignOut",
		"/memos.api.AuthService/GetCurrentUser",
		// Instance Service - admin operations
		"/memos.api.InstanceService/UpdateInstanceSetting",
		"/memos.api.InstanceService/TestInstanceEmailSetting",
		// User Service - modification operations
		"/memos.api.UserService/ListUsers",
		"/memos.api.UserService/UpdateUser",
		"/memos.api.UserService/DeleteUser",
		// Memo Service - write operations
		"/memos.api.MemoService/CreateMemo",
		"/memos.api.MemoService/UpdateMemo",
		"/memos.api.MemoService/DeleteMemo",
		// Space Service - every operation requires an authenticated member.
		"/memos.api.SpaceService/CreateSpace",
		"/memos.api.SpaceService/ListSpaces",
		"/memos.api.SpaceService/GetSpace",
		"/memos.api.SpaceService/UpdateSpace",
		"/memos.api.SpaceService/DeleteSpace",
		"/memos.api.SpaceService/CreateSpaceInvitation",
		"/memos.api.SpaceService/ListSpaceInvitations",
		"/memos.api.SpaceService/ListUserSpaceInvitations",
		"/memos.api.SpaceService/GetSpaceInvitation",
		"/memos.api.SpaceService/DeleteSpaceInvitation",
		"/memos.api.SpaceService/AcceptSpaceInvitation",
		"/memos.api.SpaceService/DeclineSpaceInvitation",
		"/memos.api.SpaceService/ListSpaceMembers",
		"/memos.api.SpaceService/GetSpaceMember",
		"/memos.api.SpaceService/UpdateSpaceMember",
		"/memos.api.SpaceService/DeleteSpaceMember",
		// Attachment Service - write operations
		"/memos.api.AttachmentService/CreateAttachment",
		"/memos.api.AttachmentService/DeleteAttachment",
		// User Service - saved memo views
		"/memos.api.UserService/CreateMemoView",
		"/memos.api.UserService/GetMemoView",
		"/memos.api.UserService/ListMemoViews",
		"/memos.api.UserService/UpdateMemoView",
		"/memos.api.UserService/DeleteMemoView",
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
		"/memos.api.UnknownService/Method",
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
		"/memos.api.AuthService/SignIn",
		"/memos.api.AuthService/RefreshToken",
		"/memos.api.UserService/CreateUser",
		"/memos.api.InstanceService/GetInstanceProfile",
		"/memos.api.InstanceService/GetInstanceSetting",
		"/memos.api.InstanceService/BatchGetInstanceSettings",
		"/memos.api.IdentityProviderService/ListIdentityProviders",
		"/memos.api.MemoService/GetSharedMemo",
	}
	for _, method := range bootstrap {
		t.Run("bootstrap/"+method, func(t *testing.T) {
			assert.True(t, IsAuthBootstrapMethod(method), "expected %s to be reachable on a private instance", method)
		})
	}

	// Public in PUBLIC mode, but gated in PRIVATE mode: browsing and profiles.
	gatedWhilePrivate := []string{
		"/memos.api.MemoService/ListMemos",
		"/memos.api.MemoService/GetMemo",
		"/memos.api.MemoService/ListMemoComments",
		"/memos.api.MemoService/ListMemoAttachments",
		"/memos.api.MemoService/ListMemoReactions",
		"/memos.api.MemoService/ListMemoRelations",
		"/memos.api.AttachmentService/GetAttachment",
		"/memos.api.UserService/GetUser",
		"/memos.api.UserService/ListUserStats",
	}
	for _, method := range gatedWhilePrivate {
		t.Run("gated/"+method, func(t *testing.T) {
			assert.False(t, IsAuthBootstrapMethod(method), "expected %s to be gated on a private instance", method)
		})
	}
}
