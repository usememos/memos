package v1

import (
	"context"
	stderrors "errors"
	"net/url"
	"slices"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/markdown"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) SetMemoAttachments(ctx context.Context, request *v1pb.SetMemoAttachmentsRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
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
	if !canModifyMemo(user, memo) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	prepared, err := s.prepareMemoAttachments(ctx, user, memo, request.Attachments)
	if err != nil {
		return nil, err
	}
	requiredAttachmentIDs, err := s.resolveMemoAttachmentReferences(memo.Content, prepared.normalized)
	if err != nil {
		return nil, err
	}
	updatedTs := time.Now().Unix()
	if err := s.applyMemoMutation(ctx, memo, prepared, &store.UpdateMemo{ID: memo.ID, UpdatedTs: &updatedTs}, requiredAttachmentIDs, nil); err != nil {
		return nil, err
	}
	updatedMemo, parentMemo, memoMessage, err := s.buildUpdatedMemoState(ctx, memo.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to build updated memo state")
	}
	s.dispatchMemoUpdatedSideEffects(ctx, updatedMemo, parentMemo, memoMessage)

	return &emptypb.Empty{}, nil
}

type preparedMemoAttachments struct {
	current    []*store.Attachment
	normalized []*store.Attachment
	removed    []*store.Attachment
}

func (s *APIV1Service) prepareMemoAttachments(
	ctx context.Context,
	user *store.User,
	memo *store.Memo,
	requestAttachments []*v1pb.Attachment,
) (*preparedMemoAttachments, error) {
	currentAttachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	normalizedAttachments, err := s.normalizeMemoAttachmentRequest(ctx, memo, currentAttachments, requestAttachments)
	if err != nil {
		return nil, err
	}

	requestedIDs := make(map[int32]bool, len(normalizedAttachments))
	for _, attachment := range normalizedAttachments {
		requestedIDs[attachment.ID] = true
	}

	removedAttachments := make([]*store.Attachment, 0)
	for _, attachment := range currentAttachments {
		if !requestedIDs[attachment.ID] {
			if attachment.CreatorID != memo.CreatorID {
				return nil, status.Errorf(codes.FailedPrecondition, "cannot remove another user's attachment from this memo")
			}
			if attachment.CreatorID != user.ID && !isSuperUser(user) {
				return nil, status.Errorf(codes.PermissionDenied, "cannot remove another user's attachment")
			}
			removedAttachments = append(removedAttachments, attachment)
		}
	}

	return &preparedMemoAttachments{
		current:    currentAttachments,
		normalized: normalizedAttachments,
		removed:    removedAttachments,
	}, nil
}

func (s *APIV1Service) applyMemoMutation(
	ctx context.Context,
	memo *store.Memo,
	prepared *preparedMemoAttachments,
	memoUpdate *store.UpdateMemo,
	requiredAttachmentIDs []int32,
	referenceRelations *[]*store.MemoRelation,
) error {
	if prepared == nil {
		prepared = &preparedMemoAttachments{}
	}
	currentIDs := make(map[int32]struct{}, len(prepared.current))
	for _, attachment := range prepared.current {
		currentIDs[attachment.ID] = struct{}{}
	}

	normalizedAttachments := slices.Clone(prepared.normalized)
	slices.Reverse(normalizedAttachments)
	bindings := make([]*store.MemoAttachmentBinding, 0, len(normalizedAttachments))
	for index, attachment := range normalizedAttachments {
		updatedTs := time.Now().Unix() + int64(index)
		_, wasBoundToMemo := currentIDs[attachment.ID]
		bindings = append(bindings, &store.MemoAttachmentBinding{
			ID:             attachment.ID,
			UID:            attachment.UID,
			UpdatedTs:      updatedTs,
			WasBoundToMemo: wasBoundToMemo,
		})
	}
	slices.SortFunc(bindings, func(a, b *store.MemoAttachmentBinding) int {
		if a.ID < b.ID {
			return -1
		}
		if a.ID > b.ID {
			return 1
		}
		return 0
	})
	removedAttachmentIDs := make([]int32, 0, len(prepared.removed))
	for _, attachment := range prepared.removed {
		removedAttachmentIDs = append(removedAttachmentIDs, attachment.ID)
	}
	if referenceRelations != nil {
		relations := make([]*store.MemoRelation, 0, len(*referenceRelations))
		for _, relation := range *referenceRelations {
			relations = append(relations, &store.MemoRelation{
				MemoID:        memo.ID,
				RelatedMemoID: relation.RelatedMemoID,
				Type:          relation.Type,
			})
		}
		referenceRelations = &relations
	}
	mutation := &store.MemoMutation{
		MemoID:                    memo.ID,
		MemoCreatorID:             memo.CreatorID,
		ExpectedMemoContent:       memo.Content,
		MemoUpdate:                memoUpdate,
		Bindings:                  bindings,
		RemovedAttachmentIDs:      removedAttachmentIDs,
		RequiredAttachmentIDs:     requiredAttachmentIDs,
		ReplaceReferenceRelations: referenceRelations != nil,
	}
	if referenceRelations != nil {
		mutation.ReferenceRelations = *referenceRelations
	}
	if err := s.Store.ApplyMemoMutation(ctx, mutation); err != nil {
		if stderrors.Is(err, store.ErrMemoMutationConflict) {
			return status.Errorf(codes.FailedPrecondition, "memo state changed: %v", err)
		}
		return status.Errorf(codes.Internal, "failed to apply memo mutation: %v", err)
	}

	// Rows are detached in the transaction above. Delete storage one at a time so
	// local cleanup remains storage-first; on failure the unlinked row remains and
	// the owner can safely retry deletion.
	for _, attachment := range prepared.removed {
		if err := s.Store.DeleteAttachment(ctx, &store.DeleteAttachment{ID: attachment.ID}); err != nil {
			return status.Errorf(codes.Internal, "failed to delete attachment: %v", err)
		}
	}

	return nil
}

func (s *APIV1Service) normalizeMemoAttachmentRequest(
	ctx context.Context,
	memo *store.Memo,
	currentAttachments []*store.Attachment,
	requestAttachments []*v1pb.Attachment,
) ([]*store.Attachment, error) {
	currentByID := make(map[int32]struct{}, len(currentAttachments))
	for _, attachment := range currentAttachments {
		currentByID[attachment.ID] = struct{}{}
	}

	requestedAttachments := make([]*store.Attachment, 0, len(requestAttachments))
	for _, requestAttachment := range requestAttachments {
		if requestAttachment == nil {
			return nil, status.Errorf(codes.InvalidArgument, "attachment is required")
		}
		attachmentUID, err := ExtractAttachmentUIDFromName(requestAttachment.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid attachment name: %v", err)
		}
		attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
		}
		if attachment == nil {
			return nil, status.Errorf(codes.NotFound, "attachment not found: %s", attachmentUID)
		}
		_, alreadyInTarget := currentByID[attachment.ID]
		if attachment.CreatorID != memo.CreatorID && !alreadyInTarget {
			// Hide another user's unlinked or foreign-memo attachment from the
			// caller. Admin status grants memo maintenance privileges, not the
			// right to transfer attachment ownership into a different account.
			return nil, status.Errorf(codes.NotFound, "attachment not found: %s", attachmentUID)
		}
		if attachment.MemoID != nil && !alreadyInTarget {
			return nil, status.Errorf(codes.FailedPrecondition, "attachment %s is already bound to another memo", attachmentUID)
		}
		requestedAttachments = append(requestedAttachments, attachment)
	}

	currentGroups := make(map[string][]*store.Attachment)
	for _, attachment := range currentAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			continue
		}
		currentGroups[motion.GroupId] = append(currentGroups[motion.GroupId], attachment)
	}

	requestGroups := make(map[string][]*store.Attachment)
	requestNamesByGroup := make(map[string]map[string]bool)
	for _, attachment := range requestedAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			continue
		}
		requestGroups[motion.GroupId] = append(requestGroups[motion.GroupId], attachment)
		if requestNamesByGroup[motion.GroupId] == nil {
			requestNamesByGroup[motion.GroupId] = make(map[string]bool)
		}
		requestNamesByGroup[motion.GroupId][attachment.UID] = true
	}

	normalized := make([]*store.Attachment, 0, len(requestedAttachments))
	appendedGroups := make(map[string]bool)
	appendedAttachments := make(map[string]bool)
	for _, attachment := range requestedAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			if !appendedAttachments[attachment.UID] {
				normalized = append(normalized, attachment)
				appendedAttachments[attachment.UID] = true
			}
			continue
		}

		groupID := motion.GroupId
		if appendedGroups[groupID] {
			continue
		}

		currentGroup := currentGroups[groupID]
		if isMultiMemberMotionGroup(currentGroup) && !allGroupMembersRequested(currentGroup, requestNamesByGroup[groupID]) {
			appendedGroups[groupID] = true
			continue
		}

		for _, groupAttachment := range requestGroups[groupID] {
			if appendedAttachments[groupAttachment.UID] {
				continue
			}
			normalized = append(normalized, groupAttachment)
			appendedAttachments[groupAttachment.UID] = true
		}
		appendedGroups[groupID] = true
	}

	return normalized, nil
}

func (s *APIV1Service) resolveMemoAttachmentReferences(content string, attachments []*store.Attachment) ([]int32, error) {
	references, err := s.extractManagedAttachmentReferences(content)
	if err != nil {
		return nil, err
	}

	attachmentsByUID := make(map[string]*store.Attachment, len(attachments))
	for _, attachment := range attachments {
		attachmentsByUID[attachment.UID] = attachment
	}
	requiredAttachmentIDs := make([]int32, 0, len(references))
	for _, reference := range references {
		attachment := attachmentsByUID[reference.UID]
		if attachment == nil {
			return nil, status.Errorf(codes.FailedPrecondition, "managed image attachment %s must be bound to the memo", reference.UID)
		}
		if !strings.HasPrefix(strings.ToLower(attachment.Type), "image/") {
			return nil, status.Errorf(codes.InvalidArgument, "managed image attachment %s must have an image MIME type", reference.UID)
		}
		if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
			return nil, status.Errorf(codes.InvalidArgument, "external attachment %s cannot be used as a managed memo image", reference.UID)
		}
		requiredAttachmentIDs = append(requiredAttachmentIDs, attachment.ID)
	}
	return requiredAttachmentIDs, nil
}

func (s *APIV1Service) extractManagedAttachmentReferences(content string) ([]markdown.ManagedAttachmentReference, error) {
	data, err := s.MarkdownService.ExtractAll([]byte(content))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid markdown content: %v", err)
	}
	if len(data.InvalidManagedAttachmentReferences) > 0 {
		return nil, status.Errorf(codes.InvalidArgument, "invalid managed attachment image URL: %s", data.InvalidManagedAttachmentReferences[0])
	}
	references := slices.Clone(data.ManagedAttachmentReferences)
	instanceURLString := ""
	if s.Profile != nil {
		instanceURLString = strings.TrimSpace(s.Profile.InstanceURL)
	}
	var instanceURL *url.URL
	if instanceURLString != "" {
		instanceURL, err = url.Parse(instanceURLString)
		if err != nil || !instanceURL.IsAbs() || instanceURL.Host == "" {
			return nil, status.Errorf(codes.Internal, "invalid configured instance URL")
		}
	}
	for _, destination := range data.ImageDestinations {
		parsed, err := url.Parse(destination)
		if err != nil || (!parsed.IsAbs() && parsed.Host == "") || !strings.HasPrefix(parsed.Path, "/file/attachments/") {
			continue
		}
		if parsed.Scheme == "" && parsed.Host != "" {
			if instanceURL == nil || sameURLAuthority(parsed, instanceURL) {
				return nil, status.Errorf(codes.InvalidArgument, "protocol-relative managed attachment image URLs are not allowed: %s", destination)
			}
			continue
		}
		if instanceURL == nil {
			return nil, status.Errorf(codes.InvalidArgument, "absolute managed attachment image URLs require a configured instance URL")
		}
		if !sameURLOrigin(parsed, instanceURL) {
			continue
		}
		relative := parsed.EscapedPath()
		if parsed.RawQuery != "" {
			relative += "?" + parsed.RawQuery
		}
		if parsed.Fragment != "" {
			relative += "#" + parsed.Fragment
		}
		uid, managed, valid := markdown.ParseManagedAttachmentImageURL(relative)
		if !managed || !valid {
			return nil, status.Errorf(codes.InvalidArgument, "invalid managed attachment image URL: %s", destination)
		}
		references = append(references, markdown.ManagedAttachmentReference{UID: uid})
	}

	seenReferences := make(map[string]struct{}, len(references))
	uniqueReferences := make([]markdown.ManagedAttachmentReference, 0, len(references))
	for _, reference := range references {
		if _, ok := seenReferences[reference.UID]; ok {
			continue
		}
		seenReferences[reference.UID] = struct{}{}
		uniqueReferences = append(uniqueReferences, reference)
	}
	return uniqueReferences, nil
}

func sameURLAuthority(candidate, instance *url.URL) bool {
	withScheme := *candidate
	withScheme.Scheme = instance.Scheme
	return sameURLOrigin(&withScheme, instance)
}

func sameURLOrigin(a, b *url.URL) bool {
	return strings.EqualFold(a.Scheme, b.Scheme) &&
		strings.EqualFold(a.Hostname(), b.Hostname()) &&
		effectiveURLPort(a) == effectiveURLPort(b)
}

func effectiveURLPort(u *url.URL) string {
	if port := u.Port(); port != "" {
		return port
	}
	switch strings.ToLower(u.Scheme) {
	case "http":
		return "80"
	case "https":
		return "443"
	default:
		return ""
	}
}

func allGroupMembersRequested(group []*store.Attachment, requestedNames map[string]bool) bool {
	if len(group) == 0 {
		return false
	}

	for _, attachment := range group {
		if !requestedNames[attachment.UID] {
			return false
		}
	}
	return true
}

func (s *APIV1Service) ListMemoAttachments(ctx context.Context, request *v1pb.ListMemoAttachmentsRequest) (*v1pb.ListMemoAttachmentsResponse, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	if err := s.checkMemoAndParentReadAccess(ctx, memo); err != nil {
		return nil, err
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments: %v", err)
	}

	response := &v1pb.ListMemoAttachmentsResponse{
		Attachments: []*v1pb.Attachment{},
	}
	for _, attachment := range attachments {
		response.Attachments = append(response.Attachments, convertAttachmentFromStore(attachment))
	}
	return response, nil
}
