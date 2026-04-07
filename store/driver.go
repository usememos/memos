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

	// Attachment model related methods.
	CreateAttachment(ctx context.Context, create *Attachment) (*Attachment, error)
	ListAttachments(ctx context.Context, find *FindAttachment) ([]*Attachment, error)
	UpdateAttachment(ctx context.Context, update *UpdateAttachment) error
	DeleteAttachment(ctx context.Context, delete *DeleteAttachment) error
	DeleteAttachments(ctx context.Context, deletes []*DeleteAttachment) error

	// Memo model related methods.
	CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
	ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
	UpdateMemo(ctx context.Context, update *UpdateMemo) error
	DeleteMemo(ctx context.Context, delete *DeleteMemo) error

	// MemoRelation model related methods.
	UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error)
	ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error)
	DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error

	// InstanceSetting model related methods.
	UpsertInstanceSetting(ctx context.Context, upsert *InstanceSetting) (*InstanceSetting, error)
	ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*InstanceSetting, error)
	DeleteInstanceSetting(ctx context.Context, delete *DeleteInstanceSetting) error

	// User model related methods.
	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) error

	// UserSetting model related methods.
	UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error)
	ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error)
	GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error)

	// IdentityProvider model related methods.
	CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error)
	ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error)
	UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error)
	DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error

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

	// Dreaming model related methods.
	CreateDreamingRun(ctx context.Context, create *DreamingRun) (*DreamingRun, error)
	ListDreamingRuns(ctx context.Context, find *FindDreamingRun) ([]*DreamingRun, error)
	UpdateDreamingRun(ctx context.Context, update *UpdateDreamingRun) error
	DeleteDreamingRun(ctx context.Context, delete *DeleteDreamingRun) error

	CreateDreamingReplayQueueItem(ctx context.Context, create *DreamingReplayQueueItem) (*DreamingReplayQueueItem, error)
	ListDreamingReplayQueueItems(ctx context.Context, find *FindDreamingReplayQueueItem) ([]*DreamingReplayQueueItem, error)
	UpdateDreamingReplayQueueItem(ctx context.Context, update *UpdateDreamingReplayQueueItem) error
	DeleteDreamingReplayQueueItem(ctx context.Context, delete *DeleteDreamingReplayQueueItem) error

	CreateDreamingInsight(ctx context.Context, create *DreamingInsight) (*DreamingInsight, error)
	ListDreamingInsights(ctx context.Context, find *FindDreamingInsight) ([]*DreamingInsight, error)
	UpdateDreamingInsight(ctx context.Context, update *UpdateDreamingInsight) error
	DeleteDreamingInsight(ctx context.Context, delete *DeleteDreamingInsight) error

	CreateDreamingInsightEvidence(ctx context.Context, create *DreamingInsightEvidence) (*DreamingInsightEvidence, error)
	ListDreamingInsightEvidences(ctx context.Context, find *FindDreamingInsightEvidence) ([]*DreamingInsightEvidence, error)

	UpsertDreamingInsightEmbedding(ctx context.Context, upsert *UpsertDreamingInsightEmbedding) error
	ListDreamingInsightEmbeddings(ctx context.Context, find *FindDreamingInsightEmbedding) ([]*DreamingInsightEmbedding, error)
}

