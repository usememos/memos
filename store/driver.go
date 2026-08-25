package store

import (
	"context"
	"database/sql"
)

// Driver is an interface for store driver.
// It contains all methods that store database driver should implement.
type Driver interface {
	GetDB() *sql.DB
	Close() error

	IsInitialized(ctx context.Context) (bool, error)

	// GetDatabaseSize returns the database size in bytes, or -1 if unavailable.
	// A non-nil error indicates a hard failure; -1 with nil error means the
	// driver cannot report a size from the underlying database.
	GetDatabaseSize(ctx context.Context) (int64, error)

	// Attachment model related methods.
	CreateAttachment(ctx context.Context, create *Attachment) (*Attachment, error)
	ListAttachments(ctx context.Context, find *FindAttachment) ([]*Attachment, error)
	UpdateAttachment(ctx context.Context, update *UpdateAttachment) error
	DeleteAttachment(ctx context.Context, delete *DeleteAttachment) error
	DeleteAttachments(ctx context.Context, deletes []*DeleteAttachment) error
	DeleteAttachmentsWithPolicy(ctx context.Context, policy *AttachmentDeletionPolicy, attachmentIDs []int32) error
	ApplyMemoMutation(ctx context.Context, mutation *MemoMutation) error

	// Memo model related methods.
	CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
	ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
	UpdateMemo(ctx context.Context, update *UpdateMemo) error
	DeleteMemo(ctx context.Context, delete *DeleteMemo) error
	DeleteMemoWithPolicy(ctx context.Context, delete *DeleteMemoWithPolicy) (*DeleteMemoWithPolicyResult, error)

	// Space model related methods.
	CreateSpace(ctx context.Context, create *Space, creatorID int32) (*Space, error)
	ListSpaces(ctx context.Context, find *FindSpace) ([]*Space, error)
	UpdateSpace(ctx context.Context, update *UpdateSpace, actorUserID int32) (*Space, error)
	DeleteSpace(ctx context.Context, delete *DeleteSpace) (*DeleteSpaceResult, error)
	ListSpaceMembers(ctx context.Context, find *FindSpaceMember) ([]*SpaceMember, error)
	UpdateSpaceMember(ctx context.Context, update *UpdateSpaceMember, actorUserID int32) (*SpaceMember, error)
	DeleteSpaceMember(ctx context.Context, delete *DeleteSpaceMember, actorUserID int32) error
	CreateSpaceInvitation(ctx context.Context, create *SpaceInvitation, actorUserID int32) (*SpaceInvitation, error)
	ListSpaceInvitations(ctx context.Context, find *FindSpaceInvitation) ([]*SpaceInvitation, error)
	AcceptSpaceInvitation(ctx context.Context, accept *AcceptSpaceInvitation, actorUserID int32) (*SpaceMember, error)
	DeclineSpaceInvitation(ctx context.Context, decline *DeclineSpaceInvitation, actorUserID int32) error
	RevokeSpaceInvitation(ctx context.Context, revoke *RevokeSpaceInvitation, actorUserID int32) error

	// MemoRelation model related methods.
	UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error)
	ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error)
	DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error

	// InstanceSetting model related methods.
	// CreateInstanceSettingIfNotExists atomically creates the setting when its name is absent and reports whether it inserted the row.
	CreateInstanceSettingIfNotExists(ctx context.Context, create *InstanceSetting) (bool, error)
	UpsertInstanceSetting(ctx context.Context, upsert *InstanceSetting) (*InstanceSetting, error)
	ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*InstanceSetting, error)
	DeleteInstanceSetting(ctx context.Context, delete *DeleteInstanceSetting) error

	// User model related methods.
	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) (*DeleteUserResult, error)

	// UserSetting model related methods.
	UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error)
	ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error)
	DeleteUserSettings(ctx context.Context, delete *DeleteUserSetting) error
	GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error)

	// IdentityProvider model related methods.
	CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error)
	ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error)
	UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error)
	DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error
	ApplyAuthenticationConfigMutation(ctx context.Context, mutation *AuthenticationConfigMutation) error
	IsRetryableAuthenticationMutationError(err error) bool

	// Inbox model related methods.
	CreateInbox(ctx context.Context, create *Inbox) (*Inbox, error)
	ListInboxes(ctx context.Context, find *FindInbox) ([]*Inbox, error)
	UpdateInbox(ctx context.Context, update *UpdateInbox) (*Inbox, error)
	DeleteInbox(ctx context.Context, delete *DeleteInbox) error

	// Reaction model related methods.
	UpsertReaction(ctx context.Context, create *Reaction) (*Reaction, error)
	ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error)
	GetReaction(ctx context.Context, find *FindReaction) (*Reaction, error)
	DeleteReaction(ctx context.Context, delete *DeleteReaction) error

	// MemoShare model related methods.
	CreateMemoShare(ctx context.Context, create *MemoShare) (*MemoShare, error)
	ListMemoShares(ctx context.Context, find *FindMemoShare) ([]*MemoShare, error)
	GetMemoShare(ctx context.Context, find *FindMemoShare) (*MemoShare, error)
	DeleteMemoShare(ctx context.Context, delete *DeleteMemoShare) error

	// UserIdentity model related methods.
	CreateUserIdentity(ctx context.Context, create *UserIdentity) (*UserIdentity, error)
	CreateUserWithIdentity(ctx context.Context, createUser *User, createIdentity *UserIdentity) (*User, error)
	ListUserIdentities(ctx context.Context, find *FindUserIdentity) ([]*UserIdentity, error)
	DeleteUserIdentities(ctx context.Context, delete *DeleteUserIdentity) error
}
