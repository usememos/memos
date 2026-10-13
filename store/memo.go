package store

import (
	"context"
	"errors"
	"log/slog"

	"github.com/usememos/memos/internal/base"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Protected is the PROTECTED visibility.
	Protected Visibility = "PROTECTED"
	// Private is the PRIVATE visibility.
	Private Visibility = "PRIVATE"
)

// HomeFolderPath is the reserved folder holding a user's single Home
// configuration document. It lives here, not only in the API layer, because the
// query builder has to recognise the folder to filter on it.
const HomeFolderPath = ".home"

func (v Visibility) String() string {
	switch v {
	case Public:
		return "PUBLIC"
	case Protected:
		return "PROTECTED"
	default:
		return "PRIVATE"
	}
}

type Memo struct {
	// ID is the system generated unique identifier for the memo.
	ID int32
	// UID is the user defined unique identifier for the memo.
	UID string

	// Standard fields
	RowStatus RowStatus
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility
	Pinned     bool
	Payload    *storepb.MemoPayload

	// Hierarchical-notes fields
	WorkspaceID int32
	// FolderPath is the slash-separated folder path (relative to the workspace root)
	// the memo lives under. Empty string means the workspace root.
	FolderPath string
	// Title is the document's display name (the "filename"). Required for HTML
	// documents since they have no H1 heading to derive a title from.
	Title string
	// DocType is one of "MARKDOWN", "HTML", "PDF", "VIEW", or "BLOGVIEW".
	DocType string

	// Composed fields
	ParentUID *string
}

type FindMemo struct {
	ID  *int32
	UID *string

	IDList  []int32
	UIDList []string

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int32

	// Domain specific fields
	VisibilityList  []Visibility
	ExcludeContent  bool
	ExcludeComments bool
	Filters         []string

	// Hierarchical-notes fields
	WorkspaceID *int32
	// FolderPathPrefix, when set, matches memos whose FolderPath equals this value
	// or is nested under it (i.e. FolderPath == prefix OR FolderPath LIKE prefix + "/%").
	FolderPathPrefix *string
	// FolderPathList matches memos whose FolderPath is exactly one of these values.
	FolderPathList []string
	// VisibleWorkspaceIDs restricts a cross-workspace listing to the knowledge bases
	// the caller has been granted, which is the outer gate of the access model. PUBLIC
	// documents are exempt: they are readable by anyone, including anonymous visitors,
	// so workspace membership cannot be what decides them.
	//
	// Nil means "no workspace restriction" (the team owner, whose access is implicit).
	// An empty, non-nil slice means "no workspace at all" — a member with no grants,
	// who still sees PUBLIC documents.
	VisibleWorkspaceIDs []int32
	// ExcludeHiddenWorkspaces drops memos living in a soft-deleted (hidden) workspace.
	// Set it on cross-workspace listings — Explore, search — so hiding actually hides.
	// Listings already scoped to one workspace by ID leave it off: reaching a hidden
	// workspace directly is what makes restoring it possible.
	ExcludeHiddenWorkspaces bool
	// HomeDocViewerID drops every other user's Home configuration document from the
	// result, keeping only the viewer's own. The Home document is one-per-user by
	// construction, so a listing that returns someone else's is never useful — and
	// the team owner, who may read every knowledge base, would otherwise pick up all
	// of them. Nil leaves home documents alone (the store's own callers, backfills).
	HomeDocViewerID *int32

	// Pagination
	Limit  *int
	Offset *int

	// Ordering
	OrderByPinned    bool
	OrderByUpdatedTs bool
	OrderByTimeAsc   bool
}

type FindMemoPayload struct {
	Raw                *string
	TagSearch          []string
	HasLink            bool
	HasTaskList        bool
	HasCode            bool
	HasIncompleteTasks bool
}

type UpdateMemo struct {
	ID         int32
	UID        *string
	CreatedTs  *int64
	UpdatedTs  *int64
	RowStatus  *RowStatus
	Content    *string
	Visibility *Visibility
	Pinned     *bool
	Payload    *storepb.MemoPayload

	WorkspaceID *int32
	FolderPath  *string
	Title       *string
	DocType     *string

	// SkipReindex suppresses the search-index re-enqueue that an update normally
	// triggers. Set it for updates that cannot change what gets indexed (chunks are
	// built from Title + Content only), e.g. the startup payload rebuild. Without it
	// every such write re-queues the memo and forces a full re-embedding run.
	SkipReindex bool
}

type DeleteMemo struct {
	ID int32
}

func (s *Store) CreateMemo(ctx context.Context, create *Memo) (*Memo, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	// Documents must have a unique title within their workspace+folder (enforced
	// by a DB unique index). Callers that don't care about titles (e.g. plain
	// memos created without the Notebook UI) would otherwise all collide on the
	// empty string, so default to the UID, which is always unique.
	if create.Title == "" {
		create.Title = create.UID
	}
	memo, err := s.driver.CreateMemo(ctx, create)
	if err != nil {
		return nil, err
	}
	s.enqueueMemoIndex(ctx, memo.ID, IndexJobReasonCreated)
	return memo, nil
}

func (s *Store) ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error) {
	return s.driver.ListMemos(ctx, find)
}

func (s *Store) GetMemo(ctx context.Context, find *FindMemo) (*Memo, error) {
	list, err := s.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (s *Store) UpdateMemo(ctx context.Context, update *UpdateMemo) error {
	if update.UID != nil && !base.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	if err := s.driver.UpdateMemo(ctx, update); err != nil {
		return err
	}
	if !update.SkipReindex && updateAffectsIndex(update) {
		s.enqueueMemoIndex(ctx, update.ID, IndexJobReasonUpdated)
	}
	return nil
}

// updateAffectsIndex reports whether an update touches fields the search index
// depends on. Chunk text is built from Title+Content, chunk rows carry
// WorkspaceID/FolderPath denormalized, and RowStatus/DocType gate indexability.
// Everything else (pin, visibility, timestamps, payload such as node_overlays or
// pdf_annotation) cannot change the index, so re-enqueuing would only burn
// embedding quota.
func updateAffectsIndex(u *UpdateMemo) bool {
	return u.Content != nil || u.Title != nil || u.DocType != nil ||
		u.RowStatus != nil || u.FolderPath != nil || u.WorkspaceID != nil
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemo) error {
	// Clean up memo_relation records where this memo is either the source or target.
	if err := s.driver.DeleteMemoRelation(ctx, &DeleteMemoRelation{MemoID: &delete.ID}); err != nil {
		return err
	}
	if err := s.driver.DeleteMemoRelation(ctx, &DeleteMemoRelation{RelatedMemoID: &delete.ID}); err != nil {
		return err
	}
	// Clean up attachments linked to this memo.
	attachments, err := s.ListAttachments(ctx, &FindAttachment{MemoID: &delete.ID})
	if err != nil {
		return err
	}
	for _, attachment := range attachments {
		if err := s.DeleteAttachment(ctx, &DeleteAttachment{ID: attachment.ID}); err != nil {
			return err
		}
	}
	// Clean up the reverse-link index: this memo's own outbound links, and any
	// inbound links other memos recorded toward it (otherwise those rows would
	// dangle, pointing at a target_memo_id that no longer exists).
	if err := s.driver.DeleteMemoLinks(ctx, &DeleteMemoLink{MemoID: &delete.ID}); err != nil {
		return err
	}
	if err := s.driver.DeleteMemoLinks(ctx, &DeleteMemoLink{TargetMemoID: &delete.ID}); err != nil {
		return err
	}
	// Clean up search index artifacts (best-effort; not supported on all drivers).
	_ = s.driver.DeleteMemoChunks(ctx, delete.ID)
	_ = s.driver.DeleteMemoIndexJob(ctx, delete.ID)
	return s.driver.DeleteMemo(ctx, delete)
}

// enqueueMemoIndex best-effort enqueues a memo for (re)indexing. Failures are
// logged and swallowed so memo writes never fail because of the search index
// (e.g. on database drivers where RAG indexing is unsupported).
func (s *Store) enqueueMemoIndex(ctx context.Context, memoID int32, reason string) {
	if err := s.driver.UpsertMemoIndexJob(ctx, memoID, reason); err != nil {
		slog.Debug("failed to enqueue memo index job", slog.Int("memoID", int(memoID)), slog.Any("err", err))
	}
}
