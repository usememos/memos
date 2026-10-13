package v1

import (
	"context"
	stderrors "errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/internal/httpgetter"
	"github.com/usememos/memos/internal/webhook"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

// suppressSSEKey is a context key used to suppress the SSE broadcast from
// CreateMemo when it is called internally (e.g., from CreateMemoComment).
type suppressSSEKey struct{}

const maxBatchGetLinkMetadata = 10

var fetchHTMLMeta = httpgetter.GetHTMLMeta

func withSuppressSSE(ctx context.Context) context.Context {
	return context.WithValue(ctx, suppressSSEKey{}, true)
}

func isSSESuppressed(ctx context.Context) bool {
	v, ok := ctx.Value(suppressSSEKey{}).(bool)
	return ok && v
}

// isDuplicateKeyError reports whether err is a unique-constraint violation
// from any of the three supported drivers (SQLite/Postgres/MySQL).
func isDuplicateKeyError(err error) bool {
	errMsg := err.Error()
	return strings.Contains(errMsg, "UNIQUE constraint failed") ||
		strings.Contains(errMsg, "duplicate key") ||
		strings.Contains(errMsg, "Duplicate entry")
}

// duplicateMemoPathError returns the AlreadyExists error to surface when a
// memo create/update collides with an existing document at the same
// workspace + folder path + title.
func duplicateMemoPathError(err error) error {
	errMsg := err.Error()
	if strings.Contains(errMsg, "idx_memo_workspace_folder_title") || strings.Contains(errMsg, "folder_path") {
		return status.Error(codes.AlreadyExists, "a document with this title already exists in this folder")
	}
	return status.Errorf(codes.AlreadyExists, "memo already exists")
}

func (s *APIV1Service) checkMemoReadAccess(ctx context.Context, memo *store.Memo) error {
	if memo == nil {
		return status.Errorf(codes.NotFound, "memo not found")
	}

	// Archived documents stay inside the knowledge base they were archived in: any
	// member who can read the workspace can reach its recycle bin, not just the
	// author.
	if memo.RowStatus == store.Archived {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to get user")
		}
		if user == nil {
			return status.Errorf(codes.NotFound, "memo not found")
		}
		role, err := s.resolveWorkspaceAccess(ctx, user, memo.WorkspaceID)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to resolve workspace access: %v", err)
		}
		if !role.CanRead() {
			return status.Errorf(codes.NotFound, "memo not found")
		}
	}

	if memo.Visibility != store.Public {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to get user")
		}
		if user == nil {
			return status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		// The knowledge base is the whole read decision. A document belongs to the
		// knowledge base, not to whoever typed it, so being granted the knowledge base
		// means reading everything in it — PRIVATE included. Visibility only widens
		// access outward, to people who were never granted the workspace at all.
		role, err := s.resolveWorkspaceAccess(ctx, user, memo.WorkspaceID)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to resolve workspace access: %v", err)
		}
		if !role.CanRead() {
			return status.Errorf(codes.NotFound, "memo not found")
		}
	}
	return nil
}

// checkMemoWriteAccess reports whether the user may create/edit/delete this
// document. Being its author is not enough on its own: access flows from the
// workspace grant, so an author who lost access to the knowledge base loses write
// access to the documents left behind in it.
func (s *APIV1Service) checkMemoWriteAccess(ctx context.Context, user *store.User, memo *store.Memo) error {
	if user == nil {
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	role, err := s.resolveWorkspaceAccess(ctx, user, memo.WorkspaceID)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to resolve workspace access: %v", err)
	}
	if !role.CanRead() {
		return status.Errorf(codes.NotFound, "memo not found")
	}
	if !role.CanWrite() {
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return nil
}

func (s *APIV1Service) CreateMemo(ctx context.Context, request *v1pb.CreateMemoRequest) (*v1pb.Memo, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	memoUID, err := ValidateAndGenerateUID(request.MemoId)
	if err != nil {
		return nil, err
	}

	workspace, err := s.resolveWorkspaceForMemo(ctx, user, request.Memo.Workspace)
	if err != nil {
		return nil, err
	}

	create := &store.Memo{
		UID:         memoUID,
		CreatorID:   user.ID,
		Content:     request.Memo.Content,
		Visibility:  convertVisibilityToStore(request.Memo.Visibility),
		WorkspaceID: workspace.ID,
		FolderPath:  normalizeFolderPath(request.Memo.FolderPath),
		Title:       request.Memo.Title,
		DocType:     convertDocTypeToStore(request.Memo.DocType),
	}

	// A folder path under the reserved sub-document namespace binds this new
	// document to the parent it names — the path IS the binding. That is what
	// lets an agent create one with nothing but the three fields it already
	// addresses documents with: no relation write (which it cannot do anyway)
	// and no extra MCP tool. See subdoc.go.
	subDocParent, err := s.resolveSubDocParent(ctx, user, create.FolderPath)
	if err != nil {
		return nil, err
	}
	if subDocParent == nil {
		if err := checkUserFolderPath(create.FolderPath); err != nil {
			return nil, err
		}
	} else {
		// A sub-document is part of the document it hangs off, so it belongs to
		// that document's knowledge base and is exactly as visible as it is.
		// Without this it would land in the creator's *default* workspace (an
		// unqualified create resolves there), which memogit would then check out
		// into the wrong repository.
		create.WorkspaceID = subDocParent.WorkspaceID
		create.Visibility = subDocParent.Visibility
	}

	// Set custom timestamps if provided in the request.
	if request.Memo.CreateTime != nil && request.Memo.CreateTime.IsValid() {
		createdTs := request.Memo.CreateTime.AsTime().Unix()
		create.CreatedTs = createdTs
	}
	if request.Memo.UpdateTime != nil && request.Memo.UpdateTime.IsValid() {
		updatedTs := request.Memo.UpdateTime.AsTime().Unix()
		create.UpdatedTs = updatedTs
	}

	contentLengthLimit, err := s.getContentLengthLimit(ctx, create.DocType)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get content length limit")
	}
	if len(create.Content) > contentLengthLimit {
		return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
	}
	if err := memopayload.RebuildMemoPayload(ctx, create, s.MarkdownService); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
	}
	if request.Memo.Location != nil {
		create.Payload.Location = convertLocationToStore(request.Memo.Location)
	}
	if request.Memo.PdfAnnotation != nil {
		create.Payload.PdfAnnotation = convertPdfAnnotationToStore(request.Memo.PdfAnnotation)
	}
	if request.Memo.EpubAnnotation != nil {
		create.Payload.EpubAnnotation = convertEpubAnnotationToStore(request.Memo.EpubAnnotation)
	}
	if request.Memo.DocAnchor != nil {
		create.Payload.DocAnchor = convertDocAnchorToStore(request.Memo.DocAnchor)
	}
	if request.Memo.NodeOverlays != nil {
		create.Payload.NodeOverlays = request.Memo.NodeOverlays
	}
	if request.Memo.DocConfig != nil {
		create.Payload.DocConfig = convertDocConfigToStore(request.Memo.DocConfig)
	}
	// A brand-new document has no human content to protect, so an agent-created
	// one starts with the session already open: the agent's subsequent passes
	// over its own draft produce no snapshots. It closes the first time a human
	// edits the content.
	isAgent := base.ActorKindFromContext(ctx).IsAgent()
	create.Payload.AgentSessionOpen = isAgent
	applySoftBreakCreationDefault(create, isAgent)

	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		// Check for unique constraint violation (AIP-133 compliance): either the
		// memo UID itself, or the (workspace, folder_path, title) uniqueness rule.
		if isDuplicateKeyError(err) {
			if strings.Contains(err.Error(), "idx_memo_workspace_folder_title") || strings.Contains(err.Error(), "folder_path") {
				return nil, duplicateMemoPathError(err)
			}
			return nil, status.Errorf(codes.AlreadyExists, "memo with ID %q already exists", memoUID)
		}
		return nil, err
	}

	// Bind the sub-document to its parent. Same COMMENT relation a comment uses,
	// so everything that already excludes comments (folder tree, search listings,
	// RSS, stats) excludes sub-documents too, for free.
	if subDocParent != nil {
		if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        memo.ID,
			RelatedMemoID: subDocParent.ID,
			Type:          store.MemoRelationComment,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to bind sub-document to its parent")
		}
		// Reload so the response carries `parent`: it is derived from ParentUID,
		// which the store resolves by joining the comment relation — and that
		// relation did not exist when this row was read.
		bound, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to reload sub-document")
		}
		if bound != nil {
			memo = bound
		}
		s.touchSubDocParentBestEffort(ctx, memo)
	}

	// Best-effort: index this memo's outbound links so the reverse-link index
	// (P0) is populated from creation, not only after the first edit.
	s.syncMemoLinkIndex(ctx, memo)

	attachments := []*store.Attachment{}

	if len(request.Memo.Attachments) > 0 {
		if err := s.setMemoAttachmentsInternal(ctx, user, memo, request.Memo.Attachments); err != nil {
			return nil, errors.Wrap(err, "failed to set memo attachments")
		}

		a, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
			MemoID: &memo.ID,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to get memo attachments")
		}
		attachments = a
	}
	if len(request.Memo.Relations) > 0 {
		if err := s.setMemoRelationsInternal(ctx, memo, request.Memo.Relations); err != nil {
			return nil, errors.Wrap(err, "failed to set memo relations")
		}
	}

	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load memo relations")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, nil, attachments, relations)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo created webhook", slog.Any("err", err))
	}

	// Broadcast live refresh event (skipped when called from CreateMemoComment).
	if !isSSESuppressed(ctx) {
		s.SSEHub.Broadcast(&SSEEvent{
			Type:       SSEEventMemoCreated,
			Name:       memoMessage.Name,
			Visibility: memo.Visibility,
			CreatorID:  resolveSSECreatorID(memo, nil),
		})
	}

	if !isMentionNotificationSuppressed(ctx) {
		s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, nil, "")
	}

	return memoMessage, nil
}

func (s *APIV1Service) ListMemos(ctx context.Context, request *v1pb.ListMemosRequest) (*v1pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
	}
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if request.State == v1pb.State_ARCHIVED {
		state := store.Archived
		memoFind.RowStatus = &state
		// Archived memos are only visible to their creator.
		if currentUser == nil {
			return &v1pb.ListMemosResponse{}, nil
		}
		memoFind.CreatorID = &currentUser.ID
	} else {
		state := store.Normal
		memoFind.RowStatus = &state
	}

	// Parse order_by field (replaces the old sort and direction fields)
	if request.OrderBy != "" {
		if err := s.parseMemoOrderBy(request.OrderBy, memoFind); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid order_by: %v", err)
		}
	} else {
		// Default ordering by create_time desc.
		memoFind.OrderByTimeAsc = false
	}

	if request.Filter != "" {
		if err := s.validateFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	if request.Workspace != "" {
		workspaceUID, err := ExtractWorkspaceUIDFromName(request.Workspace)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid workspace name: %v", err)
		}
		workspace, err := s.Store.GetWorkspace(ctx, &store.FindWorkspace{UID: &workspaceUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get workspace: %v", err)
		}
		if workspace == nil {
			return nil, status.Errorf(codes.NotFound, "workspace not found")
		}
		// A listing scoped to one knowledge base needs access to that knowledge base;
		// an anonymous visitor keeps the PUBLIC-only view the visibility filter below
		// gives them.
		if currentUser != nil {
			role, err := s.resolveWorkspaceAccess(ctx, currentUser, workspace.ID)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to resolve workspace access: %v", err)
			}
			if !role.CanRead() {
				return nil, status.Errorf(codes.NotFound, "workspace not found")
			}
		}
		memoFind.WorkspaceID = &workspace.ID
	} else {
		// Cross-workspace listings (Explore, Archived, the Home overview) must not surface
		// documents from a hidden workspace. A listing scoped to one workspace by name is
		// direct access and is left alone, so a hidden workspace stays browsable to restore.
		memoFind.ExcludeHiddenWorkspaces = true
		// ...nor documents from a knowledge base the caller was never assigned.
		if err := s.applyCrossWorkspaceReadScope(ctx, currentUser, memoFind); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to resolve accessible workspaces: %v", err)
		}
	}

	// A listing scoped to one workspace has already passed the access check above, so
	// an anonymous caller is the only one left needing a visibility filter here.
	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		// The Home configuration document is one per user, so no listing should ever
		// hand a caller someone else's. Without this the team owner — who may read every
		// knowledge base — collects every user's Home document, and the Home page, which
		// picks the first one it finds, renders a stranger's (empty) configuration
		// instead of the owner's.
		memoFind.HomeDocViewerID = &currentUser.ID
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(pageToken.Limit)
		offset = max(int(pageToken.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}
	limit = min(limit, MaxPageSize)
	limitPlusOne := limit + 1
	memoFind.Limit = &limitPlusOne
	memoFind.Offset = &offset
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	memoMessages := []*v1pb.Memo{}
	nextPageToken := ""
	if len(memos) == limitPlusOne {
		memos = memos[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memos) == 0 {
		response := &v1pb.ListMemosResponse{
			Memos:           memoMessages,
			NextPageToken:   nextPageToken,
			SubDocsIncluded: request.IncludeSubDocs,
		}
		return response, nil
	}

	// Sub-documents ride along with the page they belong to, so they are loaded,
	// converted and paginated with their parents. Everything below works on one
	// slice; the first pageSize entries are the page itself.
	pageSize := len(memos)
	if request.IncludeSubDocs {
		subDocs, err := s.listSubDocsOf(ctx, memos, memoFind)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list sub-documents: %v", err)
		}
		memos = append(memos[:pageSize:pageSize], subDocs...)
	}

	reactionMap := make(map[string][]*store.Reaction)
	contentIDs := make([]string, 0, len(memos))

	attachmentMap := make(map[int32][]*store.Attachment)
	memoIDs := make([]int32, 0, len(memos))

	for _, m := range memos {
		contentIDs = append(contentIDs, fmt.Sprintf("%s%s", MemoNamePrefix, m.UID))
		memoIDs = append(memoIDs, m.ID)
	}

	// REACTIONS
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{ContentIDList: contentIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}
	for _, reaction := range reactions {
		reactionMap[reaction.ContentID] = append(reactionMap[reaction.ContentID], reaction)
	}

	// ATTACHMENTS
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	for _, attachment := range attachments {
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}

	// RELATIONS (batch load to avoid N+1)
	relationMap, err := s.batchConvertMemoRelations(ctx, memos, false)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to batch load memo relations")
	}
	creatorIDs := make([]int32, 0, len(memos)+len(reactions))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorMap, err := s.listUsersByID(ctx, creatorIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo creators: %v", err)
	}
	var subDocMessages []*v1pb.Memo
	for i, memo := range memos {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
		reactions := reactionMap[memoName]
		attachments := attachmentMap[memo.ID]
		relations := relationMap[memo.ID]

		memoMessage, err := s.convertMemoFromStoreWithCreators(ctx, memo, reactions, attachments, relations, creatorMap)
		if err != nil {
			if stderrors.Is(err, errMemoCreatorNotFound) {
				slog.Warn("Skipping memo with missing creator",
					slog.Int64("memo_id", int64(memo.ID)),
					slog.String("memo_uid", memo.UID),
					slog.Int64("creator_id", int64(memo.CreatorID)),
				)
				continue
			}
			return nil, errors.Wrap(err, "failed to convert memo")
		}

		if i < pageSize {
			memoMessages = append(memoMessages, memoMessage)
		} else {
			subDocMessages = append(subDocMessages, memoMessage)
		}
	}

	response := &v1pb.ListMemosResponse{
		Memos:           memoMessages,
		NextPageToken:   nextPageToken,
		SubDocs:         subDocMessages,
		SubDocsIncluded: request.IncludeSubDocs,
	}
	return response, nil
}

func (s *APIV1Service) GetMemo(ctx context.Context, request *v1pb.GetMemoRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}
	if memo.ParentUID != nil {
		parentMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get parent memo")
		}
		if parentMemo == nil {
			return nil, status.Errorf(codes.NotFound, "memo not found")
		}
		if err := s.checkMemoReadAccess(ctx, parentMemo); err != nil {
			return nil, err
		}
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load memo relations")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, relations)
	if err != nil {
		if stderrors.Is(err, errMemoCreatorNotFound) {
			return nil, status.Errorf(codes.NotFound, "memo creator not found")
		}
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	return memoMessage, nil
}

// GetLinkMetadata gets metadata for a link.
func (*APIV1Service) GetLinkMetadata(_ context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	return getLinkMetadata(request.GetUrl())
}

// BatchGetLinkMetadata gets metadata for links.
func (*APIV1Service) BatchGetLinkMetadata(_ context.Context, request *v1pb.BatchGetLinkMetadataRequest) (*v1pb.BatchGetLinkMetadataResponse, error) {
	if len(request.Urls) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "urls are required")
	}
	if len(request.Urls) > maxBatchGetLinkMetadata {
		return nil, status.Errorf(codes.InvalidArgument, "too many urls (max %d)", maxBatchGetLinkMetadata)
	}

	linkMetadata := make([]*v1pb.LinkMetadata, 0, len(request.Urls))
	for _, url := range request.Urls {
		metadata, err := getLinkMetadata(url)
		if err != nil {
			return nil, err
		}
		linkMetadata = append(linkMetadata, metadata)
	}

	return &v1pb.BatchGetLinkMetadataResponse{
		LinkMetadata: linkMetadata,
	}, nil
}

func getLinkMetadata(inputURL string) (*v1pb.LinkMetadata, error) {
	url := strings.TrimSpace(inputURL)
	if url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}
	htmlMeta, err := fetchHTMLMeta(url)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to fetch link metadata: %v", err)
	}

	return &v1pb.LinkMetadata{
		Url:         inputURL,
		Title:       htmlMeta.Title,
		Description: htmlMeta.Description,
		Image:       htmlMeta.Image,
	}, nil
}

func (s *APIV1Service) UpdateMemo(ctx context.Context, request *v1pb.UpdateMemoRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Memo.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Write access comes from the knowledge base the document lives in, not from
	// authorship: an EDITOR may edit any document in their assigned workspace.
	if err := s.checkMemoWriteAccess(ctx, user, memo); err != nil {
		return nil, err
	}

	actorIsAgent := base.ActorKindFromContext(ctx).IsAgent()
	if actorIsAgent {
		if err := checkAgentWritableFields(request.UpdateMask.Paths); err != nil {
			return nil, err
		}
	}

	// The agent_session_open bit tracks who authored what is stored now, so only
	// an authorship write moves it. A human pinning a document or toggling a view
	// knob is not authorship: clearing the bit there would make the next agent
	// write snapshot the agent's own output as if it were a human baseline.
	authorshipWrite := slices.ContainsFunc(request.UpdateMask.Paths, isAuthorshipField)

	// Snapshot before anything below mutates `memo`: the baseline is the state as
	// it stands on the server right now, which is exactly what CreateMemoHistory
	// captures. See snapshotHumanBaselineIfNeeded for the rule.
	if authorshipWrite && actorIsAgent {
		if _, err := s.snapshotHumanBaselineIfNeeded(ctx, memo, user.ID); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to snapshot memo baseline: %v", err)
		}
	}

	// The same idea for the other kind of write nobody pressed a button for:
	// auto-save. An agent write is covered by the baseline rule above and never
	// by this one, so the flag is ignored on that channel. Failing the save when
	// the version cannot be written is deliberate — an unrecoverable silent
	// overwrite is the exact thing this path exists to prevent.
	if authorshipWrite && !actorIsAgent {
		if _, err := s.snapshotAutoVersionIfNeeded(ctx, memo, user.ID, request.AutoSave); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to snapshot auto version: %v", err)
		}
	}

	update := &store.UpdateMemo{
		ID: memo.ID,
	}
	var previousContent string
	contentUpdated := false
	previousWorkspaceID := memo.WorkspaceID
	workspaceChanged := false
	var previousTitle string
	titleUpdated := false
	var previousFolderPath string
	folderPathUpdated := false
	// Set when this update files an ordinary document under another one.
	var attachParent *store.Memo
	memoArchived := false
	previousVisibility := memo.Visibility
	previousRowStatus := memo.RowStatus
	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			contentUpdated = true
			previousContent = memo.Content
			contentLengthLimit, err := s.getContentLengthLimit(ctx, memo.DocType)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get content length limit")
			}
			if len(request.Memo.Content) > contentLengthLimit {
				return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
			}
			memo.Content = request.Memo.Content
			if err := memopayload.RebuildMemoPayload(ctx, memo, s.MarkdownService); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
			}
			update.Content = &memo.Content
			update.Payload = memo.Payload
		} else if path == "visibility" {
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			if memo.ParentUID != nil {
				parentMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to get parent memo")
				}
				if parentMemo == nil {
					return nil, status.Errorf(codes.NotFound, "memo not found")
				}
				visibility = parentMemo.Visibility
			}
			update.Visibility = &visibility
		} else if path == "pinned" {
			update.Pinned = &request.Memo.Pinned
		} else if path == "state" {
			rowStatus := convertStateToStore(request.Memo.State)
			if rowStatus == store.Archived && memo.RowStatus != store.Archived {
				// P1: archiving is a container-emptying-adjacent operation (see
				// docs/dev/design/20260807-cross-reference-repair-plan.md P1) —
				// reject it if other documents still link to this one.
				excluded, err := s.internalReferenceExclusions(ctx, memo)
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to resolve internal references: %v", err)
				}
				refs, err := s.findExternalLinkReferences(ctx, []int32{memo.ID}, excluded)
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to check memo references: %v", err)
				}
				if len(refs) > 0 {
					return nil, referenceDependencyError(refs)
				}
				// A site's home page cannot go into the recycle bin: the site
				// keeps only a pointer to it and would be left with no front door.
				if err := s.guardMemoIsNotSiteDashboard(ctx, memo.ID); err != nil {
					return nil, err
				}
				memoArchived = true
			}
			update.RowStatus = &rowStatus
		} else if path == "create_time" {
			createdTs := request.Memo.CreateTime.AsTime().Unix()
			update.CreatedTs = &createdTs
		} else if path == "update_time" {
			updatedTs := time.Now().Unix()
			if request.Memo.UpdateTime != nil {
				updatedTs = request.Memo.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		} else if path == "display_time" {
			return nil, status.Errorf(codes.InvalidArgument, "display_time is not supported")
		} else if path == "location" {
			payload := memo.Payload
			payload.Location = convertLocationToStore(request.Memo.Location)
			update.Payload = payload
		} else if path == "pdf_annotation" {
			payload := memo.Payload
			payload.PdfAnnotation = convertPdfAnnotationToStore(request.Memo.PdfAnnotation)
			update.Payload = payload
		} else if path == "epub_annotation" {
			payload := memo.Payload
			payload.EpubAnnotation = convertEpubAnnotationToStore(request.Memo.EpubAnnotation)
			update.Payload = payload
		} else if path == "doc_anchor" {
			payload := memo.Payload
			payload.DocAnchor = convertDocAnchorToStore(request.Memo.DocAnchor)
			update.Payload = payload
		} else if path == "node_overlays" {
			payload := memo.Payload
			payload.NodeOverlays = request.Memo.NodeOverlays
			update.Payload = payload
		} else if path == "doc_config" {
			payload := memo.Payload
			payload.DocConfig = convertDocConfigToStore(request.Memo.DocConfig)
			update.Payload = payload
		} else if path == "icon" {
			icon, err := normalizeMemoIcon(request.Memo.Icon)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid icon: %v", err)
			}
			payload := memo.Payload
			payload.Icon = icon
			update.Payload = payload
		} else if path == "attachments" {
			if err := s.setMemoAttachmentsInternal(ctx, user, memo, request.Memo.Attachments); err != nil {
				return nil, errors.Wrap(err, "failed to set memo attachments")
			}
		} else if path == "relations" {
			if err := s.setMemoRelationsInternal(ctx, memo, request.Memo.Relations); err != nil {
				return nil, errors.Wrap(err, "failed to set memo relations")
			}
		} else if path == "folder_path" {
			folderPath := normalizeFolderPath(request.Memo.FolderPath)
			// A sub-document's folder path is its binding to its parent, not a
			// location a user chose — moving it would either strand it outside
			// the tree with no parent or silently re-parent it. Neither is a
			// move; both are rejected. Promoting a sub-document to a real
			// document is a create-and-delete, done deliberately. Restating the
			// path it already has is not a move (memogit sends folder path and
			// title together on a rename).
			if IsReservedFolderPath(memo.FolderPath) {
				if folderPath == memo.FolderPath {
					continue
				}
				return nil, status.Errorf(codes.InvalidArgument, "a sub-document cannot be moved")
			}
			if IsReservedFolderPath(folderPath) {
				// The other direction is allowed: an ordinary document filed
				// under another one becomes its sub-document in place, keeping
				// its uid, history and comments. The binding itself is written
				// after the row update below.
				parent, err := s.prepareSubDocAttach(ctx, user, memo, folderPath)
				if err != nil {
					return nil, err
				}
				attachParent = parent
			} else if err := checkUserFolderPath(folderPath); err != nil {
				return nil, err
			}
			folderPathUpdated = true
			previousFolderPath = memo.FolderPath
			update.FolderPath = &folderPath
		} else if path == "title" {
			titleUpdated = true
			previousTitle = memo.Title
			update.Title = &request.Memo.Title
		} else if path == "doc_type" {
			docType := convertDocTypeToStore(request.Memo.DocType)
			update.DocType = &docType
		} else if path == "workspace" {
			// A sub-document lives in its parent's knowledge base by definition;
			// moving it alone would break that.
			if IsReservedFolderPath(memo.FolderPath) {
				return nil, status.Errorf(codes.InvalidArgument, "a sub-document cannot be moved")
			}
			workspace, err := s.resolveWorkspaceForMemo(ctx, user, request.Memo.Workspace)
			if err != nil {
				return nil, err
			}
			if workspace.ID != memo.WorkspaceID {
				// P6 used to reject this move outright, because a root-relative
				// href is only meaningful inside one knowledge base and there
				// was no form that could survive the crossing. The
				// workspace-qualified form (库限定路径) is that form, so the
				// move is now allowed and repaired in both directions after it
				// commits: referencers left behind are rewritten to
				// "@新库标题/…" (repairInboundLinksBestEffort), and the mover's
				// own outbound links to "@旧库标题/…"
				// (rewriteOutboundLinksAfterWorkspaceMoveBestEffort). See
				// docs/dev/design/20260829-relative-and-cross-workspace-refs.md
				// R2.5.
				workspaceChanged = true
			}
			update.WorkspaceID = &workspace.ID
		}
	}

	if attachParent != nil {
		if workspaceChanged {
			return nil, status.Errorf(codes.InvalidArgument,
				"cannot move a document to another knowledge base and make it a sub-document in one update")
		}
		// A sub-document is exactly as visible as the document it belongs to,
		// whatever visibility the same request may have asked for.
		update.Visibility = &attachParent.Visibility
	}

	// Record who authored what is now stored. The payload is the one loaded with
	// the memo and mutated in place by the mask loop above, so this rides along
	// with whatever else changed; it is assigned to update.Payload unconditionally
	// because an authorship write with no other payload-touching path would
	// otherwise leave the bit unpersisted.
	if authorshipWrite {
		memo.Payload.AgentSessionOpen = actorIsAgent
		memo.Payload.AgentEditAcknowledged = false
		update.Payload = memo.Payload
	}

	// Content and structural changes must bump updated_ts even when the caller
	// didn't ask for "update_time". memogit push sends content-only updates, and
	// both incremental sync and the workspace tree's freshness tint depend on
	// this timestamp. An explicit update_time still takes precedence.
	if update.UpdatedTs == nil &&
		(update.Content != nil || update.FolderPath != nil || update.Title != nil || update.WorkspaceID != nil || update.DocType != nil) {
		now := time.Now().Unix()
		update.UpdatedTs = &now
	}

	if err = s.Store.UpdateMemo(ctx, update); err != nil {
		if isDuplicateKeyError(err) {
			return nil, duplicateMemoPathError(err)
		}
		return nil, status.Errorf(codes.Internal, "failed to update memo")
	}

	// Bind an attached sub-document to its parent — the same COMMENT relation
	// CreateMemo writes for a new one. Before the reload below, so the
	// returned memo already carries its parent.
	if attachParent != nil {
		if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        memo.ID,
			RelatedMemoID: attachParent.ID,
			Type:          store.MemoRelationComment,
		}); err != nil {
			// Without the relation the row sits under "_sub/<uid>" with no parent:
			// out of the tree and reachable by nothing. Put it back where it was.
			if restoreErr := s.Store.UpdateMemo(ctx, &store.UpdateMemo{
				ID:         memo.ID,
				FolderPath: &previousFolderPath,
				Visibility: &previousVisibility,
			}); restoreErr != nil {
				slog.Warn("failed to restore document after a failed sub-document attach",
					slog.Int("memoID", int(memo.ID)), slog.Any("err", restoreErr))
			}
			return nil, status.Errorf(codes.Internal, "failed to bind sub-document to its parent")
		}
	}

	memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}

	// The comments hanging off this document inherit its visibility, and until now
	// that inheritance only happened once, when each comment was created. A document
	// later made private therefore kept comments still marked public. Realign them.
	if update.Visibility != nil && *update.Visibility != previousVisibility {
		if err := s.cascadeCommentVisibility(ctx, memo); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to cascade comment visibility: %v", err)
		}
	}

	// A sub-document has no life of its own: it is part of the document it hangs
	// off, so it follows that document into and out of the recycle bin. Comments
	// deliberately do NOT follow — they are a discussion about the document, and
	// archiving one has never meant archiving its thread.
	if update.RowStatus != nil && *update.RowStatus != previousRowStatus {
		if err := s.cascadeSubDocState(ctx, memo); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to cascade sub-document state: %v", err)
		}
	}

	// Editing a sub-document is an edit to the document it belongs to, so the
	// parent's updated_ts moves with it — both for the freshness tint and so an
	// incremental mirror can see the change at all.
	s.touchSubDocParentBestEffort(ctx, memo)

	// P0: content changed, so this memo's outbound reverse-link index entries
	// are stale — full reparse and overwrite. Best-effort by design.
	if contentUpdated {
		s.syncMemoLinkIndex(ctx, memo)
	}
	// P4: title and/or folder_path changed (same-workspace rename/move), so
	// referencers' hrefs into this memo are stale and must be repaired
	// unconditionally; anchor text is repaired independently, only when it
	// exactly equals the old title (P2's original rule, unchanged in scope).
	titleChanged := titleUpdated && previousTitle != memo.Title
	folderChanged := folderPathUpdated && previousFolderPath != memo.FolderPath
	// A cross-workspace move stales referencers' hrefs just as a rename does —
	// more so, since the path they spell now names nothing at all — so it goes
	// through the same inbound repair even when neither title nor folder moved.
	if titleChanged || folderChanged || workspaceChanged {
		if !titleChanged {
			// Anchor-text repair keys off "text == previousTitle"; when only the
			// folder moved, the title didn't change, so the comparison must use
			// the current (unchanged) title rather than the zero value.
			previousTitle = memo.Title
		}
		if !folderChanged {
			// Same reasoning for the "as-of" tree used to resolve referencers'
			// stale hrefs: when only the title changed, the folder is unchanged.
			previousFolderPath = memo.FolderPath
		}
		s.repairInboundLinksBestEffort(ctx, memo, previousTitle, previousFolderPath)
		// The pass above repairs OTHER documents' hrefs into this one. This
		// document's own outbound document-relative hrefs are stale for the
		// opposite reason — it is the end that moved — and only a folder change
		// can do that. Skipped when the workspace changed too: those links are
		// pinned to uid form below instead, which the destination workspace's
		// tree could not resolve as paths anyway.
		if folderChanged && !workspaceChanged {
			s.fossilizeOutboundRelativeLinksBestEffort(ctx, memo.WorkspaceID, map[int32]string{memo.ID: previousFolderPath})
		}
	}
	// Archiving equals a takedown (publish requirement §9): the public read path
	// only checks publication state, so a document left in the recycle bin would
	// otherwise stay readable on every site it was published to.
	if memoArchived {
		s.takeDownPublicationsForMemoBestEffort(ctx, memo.ID)
	}
	// P6, the other direction: the check above guards documents linking INTO
	// this one, but this one's own root-relative hrefs name paths in the
	// workspace it just left and would go dead. Pin them to uid form instead.
	if workspaceChanged {
		// Document-relative hrefs resolve against the folder the memo was in
		// before the move. previousFolderPath only holds that when folder_path
		// was part of this same update; otherwise the folder didn't change and
		// the current one is also the old one.
		oldFolderPath := memo.FolderPath
		if folderPathUpdated {
			oldFolderPath = previousFolderPath
		}
		s.rewriteOutboundLinksAfterWorkspaceMoveBestEffort(ctx, map[int32]string{memo.ID: oldFolderPath}, previousWorkspaceID, nil)
	}

	memo, parentMemo, memoMessage, err := s.buildUpdatedMemoState(ctx, memo.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build updated memo state")
	}
	if contentUpdated {
		s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, parentMemo, previousContent)
	}
	s.dispatchMemoUpdatedSideEffects(ctx, memo, parentMemo, memoMessage)

	return memoMessage, nil
}

// cascadeCommentVisibility rewrites the visibility of a document's comments to match
// the document's own.
//
// CreateMemoComment stamps a new comment with its parent's visibility, but that was
// only ever a snapshot: nothing re-applied it afterwards, so a public document that
// collected comments and was then made private ended up with public comments hanging
// off it. The alignment goes both ways, exactly as the create-time assignment does —
// only tightening would leave the opposite inconsistency behind (a document put back
// to public keeping private comments).
//
// The comment relation is one level deep — a comment cannot itself be commented on —
// so there is no chain to walk.
func (s *APIV1Service) cascadeCommentVisibility(ctx context.Context, memo *store.Memo) error {
	commentType := store.MemoRelationComment
	relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
		Type:          &commentType,
	})
	if err != nil {
		return errors.Wrap(err, "failed to list memo comments")
	}

	for _, relation := range relations {
		comment, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &relation.MemoID})
		if err != nil {
			return errors.Wrap(err, "failed to get memo comment")
		}
		if comment == nil || comment.Visibility == memo.Visibility {
			continue
		}
		visibility := memo.Visibility
		if err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{
			ID:         comment.ID,
			Visibility: &visibility,
			// Visibility is not part of what gets indexed (title and content are), so
			// this must not re-queue the comment for embedding.
			SkipReindex: true,
		}); err != nil {
			return errors.Wrap(err, "failed to update memo comment visibility")
		}
	}
	return nil
}

func (s *APIV1Service) DeleteMemo(ctx context.Context, request *v1pb.DeleteMemoRequest) (*emptypb.Empty, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Same rule as UpdateMemo: deleting a document is a document-level write, gated
	// by the workspace grant rather than by authorship.
	if err := s.checkMemoWriteAccess(ctx, user, memo); err != nil {
		return nil, err
	}

	// P1: reject a hard delete if other documents still link to this one.
	excluded, err := s.internalReferenceExclusions(ctx, memo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve internal references: %v", err)
	}
	refs, err := s.findExternalLinkReferences(ctx, []int32{memo.ID}, excluded)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check memo references: %v", err)
	}
	if len(refs) > 0 {
		return nil, referenceDependencyError(refs)
	}
	// Same rule for a site home page: the site holds a pointer, not a copy.
	if err := s.guardMemoIsNotSiteDashboard(ctx, memo.ID); err != nil {
		return nil, err
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	deleteRelations, _ := s.loadMemoRelations(ctx, memo)
	if memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, deleteRelations); err == nil {
		// Try to dispatch webhook when memo is deleted.
		if err := s.DispatchMemoDeletedWebhook(ctx, memoMessage); err != nil {
			slog.Warn("Failed to dispatch memo deleted webhook", slog.Any("err", err))
		}
	}

	// Delete memo comments first (store.DeleteMemo handles their relations and attachments)
	commentType := store.MemoRelationComment
	relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{RelatedMemoID: &memo.ID, Type: &commentType})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo comments")
	}
	for _, relation := range relations {
		if err := s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: relation.MemoID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete memo comment")
		}
	}

	// Delete the memo (store.DeleteMemo handles relation and attachment cleanup)
	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: memo.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}
	s.touchSubDocParentBestEffort(ctx, memo)

	// Broadcast live refresh event.
	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoDeleted,
		Name:       request.Name,
		Visibility: memo.Visibility,
		CreatorID:  resolveSSECreatorID(memo, nil),
	})

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) CreateMemoComment(ctx context.Context, request *v1pb.CreateMemoCommentRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if relatedMemo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	// Check memo visibility before allowing comment.
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if err := s.checkMemoReadAccess(ctx, relatedMemo); err != nil {
		return nil, err
	}
	if request.Comment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "comment is required")
	}

	comment, ok := proto.Clone(request.Comment).(*v1pb.Memo)
	if !ok {
		return nil, status.Errorf(codes.Internal, "failed to clone memo comment")
	}
	comment.Visibility = convertVisibilityFromStore(relatedMemo.Visibility)

	// Create the memo comment first; suppress the generic memo.created SSE event
	// since CreateMemoComment broadcasts memo.comment.created for the parent instead.
	memoComment, err := s.CreateMemo(withSuppressMentionNotifications(withSuppressSSE(ctx)), &v1pb.CreateMemoRequest{
		Memo:   comment,
		MemoId: request.CommentId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo")
	}
	memoUID, err = ExtractMemoUIDFromName(memoComment.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}

	// Build the relation between the comment memo and the original memo.
	_, err = s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo relation")
	}

	// The comment memo was converted before the relation above existed, so its
	// Relations slice is empty. Reload the relations now so that both the API
	// response and the memo.comment.created webhook payload carry the relation
	// to the parent memo.
	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load memo relations")
	}
	memoComment.Relations = relations

	creator, err := ResolveUserByName(ctx, s.Store, memoComment.Creator)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo creator")
	}
	if creator == nil {
		return nil, status.Errorf(codes.NotFound, "memo creator not found")
	}
	creatorID := creator.ID
	if memoComment.Visibility != v1pb.Visibility_PRIVATE && creatorID != relatedMemo.CreatorID {
		if _, err := s.createInboxWithEmailNotification(ctx, &store.Inbox{
			SenderID:   creatorID,
			ReceiverID: relatedMemo.CreatorID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
				Payload: &storepb.InboxMessage_MemoComment{
					MemoComment: &storepb.InboxMessage_MemoCommentPayload{
						MemoId:        memo.ID,
						RelatedMemoId: relatedMemo.ID,
					},
				},
			},
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create inbox")
		}
	}

	if err := s.DispatchMemoCommentCreatedWebhook(ctx, memoComment, relatedMemo.CreatorID); err != nil {
		slog.Warn("Failed to dispatch memo comment created webhook", slog.Any("err", err))
	}

	s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, relatedMemo, "")

	// Broadcast live refresh event for the parent memo so subscribers see the new comment.
	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoCommentCreated,
		Name:       request.Name,
		Visibility: relatedMemo.Visibility,
		CreatorID:  relatedMemo.CreatorID,
	})

	return memoComment, nil
}

func (s *APIV1Service) ListMemoComments(ctx context.Context, request *v1pb.ListMemoCommentsRequest) (*v1pb.ListMemoCommentsResponse, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	// checkMemoReadAccess above already granted this user the parent document, and a
	// comment lives in the same knowledge base as the document it hangs off — so a
	// signed-in reader sees every comment. Only anonymous callers are narrowed here.
	var memoFilter *string
	if currentUser == nil {
		anonymousFilter := `visibility == "PUBLIC"`
		memoFilter = &anonymousFilter
	}
	memoRelationComment := store.MemoRelationComment
	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(pageToken.Limit)
		offset = max(int(pageToken.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}
	limitPlusOne := limit + 1
	memoRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
		Type:          &memoRelationComment,
		MemoFilter:    memoFilter,
		Limit:         &limitPlusOne,
		Offset:        &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations")
	}

	nextPageToken := ""
	if len(memoRelations) == limitPlusOne {
		memoRelations = memoRelations[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memoRelations) == 0 {
		response := &v1pb.ListMemoCommentsResponse{
			Memos:         []*v1pb.Memo{},
			NextPageToken: nextPageToken,
		}
		return response, nil
	}

	memoRelationIDs := make([]int32, 0, len(memoRelations))
	for _, m := range memoRelations {
		memoRelationIDs = append(memoRelationIDs, m.MemoID)
	}
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{IDList: memoRelationIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos")
	}

	memoIDToNameMap := make(map[int32]string)
	contentIDs := make([]string, 0, len(memos))
	memoIDsForAttachments := make([]int32, 0, len(memos))

	for _, memo := range memos {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
		memoIDToNameMap[memo.ID] = memoName
		contentIDs = append(contentIDs, memoName)
		memoIDsForAttachments = append(memoIDsForAttachments, memo.ID)
	}
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{ContentIDList: contentIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	memoReactionsMap := make(map[string][]*store.Reaction)
	for _, reaction := range reactions {
		memoReactionsMap[reaction.ContentID] = append(memoReactionsMap[reaction.ContentID], reaction)
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDsForAttachments})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	attachmentMap := make(map[int32][]*store.Attachment)
	for _, attachment := range attachments {
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}

	// RELATIONS (batch load to avoid N+1)
	relationMap, err := s.batchConvertMemoRelations(ctx, memos, false)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to batch load memo relations")
	}
	creatorIDs := make([]int32, 0, len(memos)+len(reactions))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorMap, err := s.listUsersByID(ctx, creatorIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo creators: %v", err)
	}
	var memosResponse []*v1pb.Memo
	for _, m := range memos {
		memoName := memoIDToNameMap[m.ID]
		reactions := memoReactionsMap[memoName]
		attachments := attachmentMap[m.ID]
		relations := relationMap[m.ID]

		memoMessage, err := s.convertMemoFromStoreWithCreators(ctx, m, reactions, attachments, relations, creatorMap)
		if err != nil {
			if stderrors.Is(err, errMemoCreatorNotFound) {
				slog.Warn("Skipping memo comment with missing creator",
					slog.Int64("memo_id", int64(m.ID)),
					slog.String("memo_uid", m.UID),
					slog.Int64("creator_id", int64(m.CreatorID)),
					slog.String("parent_name", request.Name),
				)
				continue
			}
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		memosResponse = append(memosResponse, memoMessage)
	}

	response := &v1pb.ListMemoCommentsResponse{
		Memos:         memosResponse,
		NextPageToken: nextPageToken,
	}
	return response, nil
}

func (s *APIV1Service) getContentLengthLimit(ctx context.Context, docType string) (int, error) {
	if docType == "HTML" {
		return store.HTMLContentLengthLimit, nil
	}
	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return 0, status.Errorf(codes.Internal, "failed to get instance memo related setting")
	}
	return int(instanceMemoRelatedSetting.ContentLengthLimit), nil
}

// DispatchMemoCreatedWebhook dispatches webhook when memo is created.
func (s *APIV1Service) DispatchMemoCreatedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.created")
}

// DispatchMemoUpdatedWebhook dispatches webhook when memo is updated.
func (s *APIV1Service) DispatchMemoUpdatedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.updated")
}

// DispatchMemoDeletedWebhook dispatches webhook when memo is deleted.
func (s *APIV1Service) DispatchMemoDeletedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.deleted")
}

// DispatchMemoCommentCreatedWebhook dispatches webhook to the related memo owner when a comment is created.
func (s *APIV1Service) DispatchMemoCommentCreatedWebhook(ctx context.Context, commentMemo *v1pb.Memo, relatedMemoCreatorID int32) error {
	webhooks, err := s.Store.GetUserWebhooks(ctx, relatedMemoCreatorID)
	if err != nil {
		return err
	}
	for _, hook := range webhooks {
		payload, err := convertMemoToWebhookPayload(commentMemo)
		if err != nil {
			return errors.Wrap(err, "failed to convert memo to webhook payload")
		}
		payload.ActivityType = "memos.memo.comment.created"
		payload.URL = hook.Url
		payload.SigningSecret = hook.SigningSecret
		webhook.PostAsync(payload)
	}
	return nil
}

func (s *APIV1Service) dispatchMemoRelatedWebhook(ctx context.Context, memo *v1pb.Memo, activityType string) error {
	creator, err := ResolveUserByName(ctx, s.Store, memo.Creator)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid memo creator")
	}
	if creator == nil {
		return status.Errorf(codes.NotFound, "memo creator not found")
	}
	creatorID := creator.ID
	webhooks, err := s.Store.GetUserWebhooks(ctx, creatorID)
	if err != nil {
		return err
	}
	for _, hook := range webhooks {
		payload, err := convertMemoToWebhookPayload(memo)
		if err != nil {
			return errors.Wrap(err, "failed to convert memo to webhook payload")
		}
		payload.ActivityType = activityType
		payload.URL = hook.Url
		payload.SigningSecret = hook.SigningSecret

		// Use asynchronous webhook dispatch
		webhook.PostAsync(payload)
	}
	return nil
}

func convertMemoToWebhookPayload(memo *v1pb.Memo) (*webhook.WebhookRequestPayload, error) {
	return &webhook.WebhookRequestPayload{
		Creator: memo.Creator,
		Memo:    memo,
	}, nil
}

func (s *APIV1Service) getMemoContentSnippet(content string) (string, error) {
	// Use goldmark service for snippet generation
	snippet, err := s.MarkdownService.GenerateSnippet([]byte(content), 64)
	if err != nil {
		return "", errors.Wrap(err, "failed to generate snippet")
	}
	return snippet, nil
}

// parseMemoOrderBy parses the order_by field and sets the appropriate ordering in memoFind.
// Follows AIP-132: supports comma-separated list of fields with optional "desc" suffix.
// Example: "pinned desc, create_time desc" or "update_time asc".
func (*APIV1Service) parseMemoOrderBy(orderBy string, memoFind *store.FindMemo) error {
	if strings.TrimSpace(orderBy) == "" {
		return errors.New("empty order_by")
	}

	// Split by comma to support multiple sort fields per AIP-132.
	fields := strings.Split(orderBy, ",")

	// Track if we've seen pinned field.
	hasPinned := false
	hasExplicitTimeField := false

	for _, field := range fields {
		parts := strings.Fields(strings.TrimSpace(field))
		if len(parts) == 0 {
			continue
		}

		fieldName := parts[0]
		fieldDirection := "desc" // default per AIP-132 (we use desc as default for time fields)
		if len(parts) > 1 {
			fieldDirection = strings.ToLower(parts[1])
			if fieldDirection != "asc" && fieldDirection != "desc" {
				return errors.Errorf("invalid order direction: %s, must be 'asc' or 'desc'", parts[1])
			}
		}

		switch fieldName {
		case "pinned":
			hasPinned = true
			memoFind.OrderByPinned = true
			// Note: pinned is always DESC (true first) regardless of direction specified.
		case "create_time", "name":
			// Only set if this is the first time field we encounter.
			if !hasExplicitTimeField {
				memoFind.OrderByTimeAsc = fieldDirection == "asc"
			}
			hasExplicitTimeField = true
		case "update_time":
			// Only set if this is the first time field we encounter.
			if !hasExplicitTimeField {
				memoFind.OrderByUpdatedTs = true
				memoFind.OrderByTimeAsc = fieldDirection == "asc"
			}
			hasExplicitTimeField = true
		default:
			return errors.Errorf("unsupported order field: %s, supported fields are: pinned, create_time, update_time, name", fieldName)
		}
	}

	// If only pinned was specified, still need to set a default time ordering.
	if hasPinned && !memoFind.OrderByUpdatedTs && len(fields) == 1 {
		memoFind.OrderByTimeAsc = false // default to desc
	}

	return nil
}
