package v1

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"slices"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/core/memoexport"
	"github.com/usememos/memos/core/memopayload"
	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// PlanMemoImport classifies every record of an archive against the
// instance without writing anything.
func (s *APIV1Service) PlanMemoImport(ctx context.Context, user *store.User, archive *memoexport.File) (*v1pb.MemoImportPlan, error) {
	if user == nil || archive == nil {
		return nil, errors.New("user and archive are required")
	}
	exportTime, err := memoexport.ParseTime(archive.Manifest.ExportTime)
	if err != nil {
		return nil, errors.Wrap(err, "invalid export time")
	}
	plan := &v1pb.MemoImportPlan{
		ExportTime: timestamppb.New(time.Unix(exportTime, 0)),
		Generator:  archive.Manifest.Generator.Name + " " + archive.Manifest.Generator.Version,
		Memos:      int32(len(archive.Memos)),
		Warnings:   archiveIssues(archive.Warnings),
	}
	if archive.Manifest.Scope.User != nil {
		plan.Exporter = archive.Manifest.Scope.User.Username
	}
	for _, record := range archive.Memos {
		for _, attachment := range record.Attachments {
			if attachment.Path != "" {
				plan.Attachments++
			}
		}
	}
	existing, err := s.findMemosByUID(ctx, archive, true)
	if err != nil {
		return nil, err
	}
	for _, record := range archive.Memos {
		switch memo := existing[record.UID]; {
		case memo == nil:
			plan.New++
		case memo.CreatorID == user.ID:
			plan.Existing++
		default:
			plan.Renamed++
		}
	}
	return plan, nil
}

// findMemosByUID loads the instance memos whose UIDs appear in the archive.
func (s *APIV1Service) findMemosByUID(ctx context.Context, archive *memoexport.File, excludeContent bool) (map[string]*store.Memo, error) {
	uids := make([]string, 0, len(archive.Memos))
	for _, record := range archive.Memos {
		uids = append(uids, record.UID)
	}
	found := make(map[string]*store.Memo, len(uids))
	for chunk := range slices.Chunk(uids, archiveQueryChunk) {
		memos, err := s.Store.ListMemos(ctx, &store.FindMemo{UIDList: chunk, ExcludeContent: excludeContent})
		if err != nil {
			return nil, errors.Wrap(err, "failed to look up memos")
		}
		for _, memo := range memos {
			found[memo.UID] = memo
		}
	}
	return found, nil
}

func archiveIssues(warnings []memoexport.Warning) []*v1pb.MemoImportIssue {
	issues := make([]*v1pb.MemoImportIssue, 0, len(warnings))
	for _, warning := range warnings {
		issues = append(issues, &v1pb.MemoImportIssue{Memo: warning.UID, Message: warning.Message})
	}
	return issues
}

// writtenMemo pairs an archive record with the instance memo it was created
// as or merged into, for the relation pass.
type writtenMemo struct {
	record *memoexport.Memo
	memo   *store.Memo
}

type memoImporter struct {
	service *APIV1Service
	ctx     context.Context
	user    *store.User
	archive *memoexport.File
	policy  v1pb.ImportMemosRequest_ConflictPolicy
	report  *v1pb.MemoImportReport

	storageSetting     *storepb.InstanceStorageSetting
	contentLengthLimit int
	// existing holds the instance memos whose UIDs the archive uses, keyed by
	// UID, loaded once before any write.
	existing map[string]*store.Memo
	// resolved maps archive memo UIDs to the instance memos they became,
	// including skipped ones so comments and references can point at them.
	resolved map[string]*store.Memo
	// written lists the records that were created or updated, whose
	// relations are applied once every record exists.
	written []writtenMemo
	// spaces caches Space resolution per archive Space UID; memberSpaces is
	// the importer's Space list, loaded on first use.
	spaces       map[string]*int32
	memberSpaces []*store.Space
}

// ImportMemoExport applies an opened archive to the importing user's memos
// following the documented import semantics. The user in ctx must be the
// same as user.
func (s *APIV1Service) ImportMemoExport(ctx context.Context, user *store.User, archive *memoexport.File, policy v1pb.ImportMemosRequest_ConflictPolicy) (*v1pb.MemoImportReport, error) {
	if user == nil || archive == nil {
		return nil, errors.New("user and archive are required")
	}
	if policy == v1pb.ImportMemosRequest_CONFLICT_POLICY_UNSPECIFIED {
		policy = v1pb.ImportMemosRequest_SKIP
	}
	storageSetting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance storage setting")
	}
	contentLengthLimit, err := s.getContentLengthLimit(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get content length limit")
	}
	existing, err := s.findMemosByUID(ctx, archive, false)
	if err != nil {
		return nil, err
	}
	importer := &memoImporter{
		service:            s,
		ctx:                ctx,
		user:               user,
		archive:            archive,
		policy:             policy,
		report:             &v1pb.MemoImportReport{Warnings: archiveIssues(archive.Warnings)},
		storageSetting:     storageSetting,
		contentLengthLimit: contentLengthLimit,
		existing:           existing,
		resolved:           make(map[string]*store.Memo, len(archive.Memos)),
		spaces:             make(map[string]*int32),
	}
	for _, record := range archive.Memos {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if err := importer.importMemo(record); err != nil {
			importer.report.Failed++
			importer.report.Failures = append(importer.report.Failures, &v1pb.MemoImportIssue{Memo: record.UID, Message: err.Error()})
			continue
		}
		// An imported memo counts against the same write budget as one
		// created through CreateMemo, so an archive cannot bypass it.
		s.charge(ratelimit.ScopeWriteUser, userKey(user.ID), 1)
	}
	for _, written := range importer.written {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if err := importer.applyRelations(written); err != nil {
			importer.warn(written.record.UID, "relations were not applied: "+err.Error())
		}
	}
	if importer.report.Created > 0 || importer.report.Updated > 0 {
		s.SSEHub.publishMemoChanged()
	}
	return importer.report, nil
}

func (i *memoImporter) warn(uid, message string) {
	i.report.Warnings = append(i.report.Warnings, &v1pb.MemoImportIssue{Memo: uid, Message: message})
}

func (i *memoImporter) importMemo(record *memoexport.Memo) error {
	content, err := i.archive.Content(record)
	if err != nil {
		return err
	}
	if len(content) > i.contentLengthLimit {
		return errors.Errorf("content too long (max %d characters)", i.contentLengthLimit)
	}
	targetUID := record.UID
	if existing := i.existing[record.UID]; existing != nil {
		if existing.CreatorID == i.user.ID {
			switch i.policy {
			case v1pb.ImportMemosRequest_SKIP:
				i.resolved[record.UID] = existing
				i.report.Skipped++
				return nil
			case v1pb.ImportMemosRequest_REPLACE:
				return i.replaceMemo(record, existing, content)
			}
		}
		targetUID = shortuuid.New()
	}
	return i.createMemo(record, targetUID, content)
}

func (i *memoImporter) createMemo(record *memoexport.Memo, targetUID string, content []byte) error {
	memo, err := i.buildMemo(record, targetUID, content)
	if err != nil {
		return err
	}
	var parentID *int32
	if record.Parent != "" {
		parent, err := i.resolveMemo(record.Parent)
		if err != nil {
			return err
		}
		if parent == nil {
			i.warn(record.UID, fmt.Sprintf("parent memo %s was not found; imported as a top-level memo", record.Parent))
		} else {
			parentID = &parent.ID
		}
	}
	added, err := i.importAttachments(record, nil)
	if err != nil {
		return err
	}
	// Creation never sets pinned or the lifecycle state; they follow in a
	// second write, as they do for a memo created through the API.
	wantPinned, wantRowStatus := memo.Pinned, memo.RowStatus
	err = i.bindAttachments(memo, added, added, func(prepared *preparedMemoAttachments, required []int32) error {
		if err := i.service.createMemoWithMutation(i.ctx, i.user, memo, parentID, prepared, required, nil); err != nil {
			return mapMemoCreateError(err, targetUID, "failed to create memo")
		}
		return nil
	})
	if err != nil {
		return err
	}
	if wantPinned || wantRowStatus == store.Archived {
		update := &store.UpdateMemo{ID: memo.ID, UpdatedTs: &memo.UpdatedTs}
		if wantPinned {
			update.Pinned = &wantPinned
		}
		if wantRowStatus == store.Archived {
			update.RowStatus = &wantRowStatus
		}
		if err := i.service.Store.UpdateMemo(i.ctx, update); err != nil {
			return mapMemoWriteError(err, "failed to apply memo state")
		}
		memo.Pinned, memo.RowStatus = wantPinned, wantRowStatus
	}
	i.resolved[record.UID] = memo
	i.written = append(i.written, writtenMemo{record: record, memo: memo})
	i.report.Created++
	return nil
}

func (i *memoImporter) replaceMemo(record *memoexport.Memo, existing *store.Memo, content []byte) error {
	next, err := i.buildMemo(record, existing.UID, content)
	if err != nil {
		return err
	}
	if record.Parent != "" && (existing.ParentUID == nil || *existing.ParentUID != record.Parent) {
		i.warn(record.UID, "comment threading of an existing memo cannot be changed; the parent from the archive was ignored")
	}
	update := &store.UpdateMemo{
		ID:         existing.ID,
		Content:    &next.Content,
		Payload:    next.Payload,
		Visibility: &next.Visibility,
		Pinned:     &next.Pinned,
		RowStatus:  &next.RowStatus,
		CreatedTs:  &next.CreatedTs,
		UpdatedTs:  &next.UpdatedTs,
		ClearSpace: next.SpaceID == nil,
		SpaceID:    next.SpaceID,
	}
	current, err := i.service.Store.ListAttachments(i.ctx, &store.FindAttachment{MemoID: &existing.ID})
	if err != nil {
		return errors.Wrap(err, "failed to list attachments")
	}
	names := make([]*v1pb.Attachment, 0, len(current)+len(record.Attachments))
	for _, attachment := range current {
		names = append(names, &v1pb.Attachment{Name: AttachmentNamePrefix + attachment.UID})
	}
	added, err := i.importAttachments(record, current)
	if err != nil {
		return err
	}
	err = i.bindAttachments(existing, append(names, added...), added, func(prepared *preparedMemoAttachments, required []int32) error {
		return i.service.applyMemoMutation(i.ctx, existing, prepared, update, required, nil)
	})
	if err != nil {
		return err
	}
	i.resolved[record.UID] = existing
	i.written = append(i.written, writtenMemo{record: record, memo: existing})
	i.report.Updated++
	return nil
}

// bindAttachments prepares the memo's attachment set, resolves the managed
// references in its content, and runs write. When any step fails, the
// attachments this run created for the memo are removed again.
func (i *memoImporter) bindAttachments(memo *store.Memo, names, added []*v1pb.Attachment, write func(*preparedMemoAttachments, []int32) error) error {
	err := func() error {
		prepared, err := i.service.prepareMemoAttachments(i.ctx, i.user, memo, names)
		if err != nil {
			return err
		}
		required, err := i.service.resolveMemoAttachmentReferences(memo.Content, prepared.normalized)
		if err != nil {
			return err
		}
		return write(prepared, required)
	}()
	if err != nil {
		i.discardAttachments(added)
	}
	return err
}

// buildMemo turns a record into the memo row to write, resolving the Space
// and applying the visibility fallback.
func (i *memoImporter) buildMemo(record *memoexport.Memo, uid string, content []byte) (*store.Memo, error) {
	createdTs, err := memoexport.ParseTime(record.CreateTime)
	if err != nil {
		return nil, err
	}
	updatedTs, err := memoexport.ParseTime(record.UpdateTime)
	if err != nil {
		return nil, err
	}
	memo := &store.Memo{
		UID:        uid,
		CreatorID:  i.user.ID,
		RowStatus:  store.RowStatus(record.State),
		CreatedTs:  createdTs,
		UpdatedTs:  updatedTs,
		Content:    string(content),
		Visibility: store.Visibility(record.Visibility),
		Pinned:     record.Pinned,
	}
	if record.Space != nil {
		spaceID, err := i.resolveSpace(record.Space)
		if err != nil {
			return nil, err
		}
		if spaceID == nil {
			i.warn(record.UID, fmt.Sprintf("space %q was not found among your spaces; imported without a space", record.Space.UID))
		}
		memo.SpaceID = spaceID
	}
	if memo.Visibility == store.SpaceAudience && memo.SpaceID == nil {
		i.warn(record.UID, "SPACE visibility needs a space; imported as PRIVATE")
		memo.Visibility = store.Private
	}
	if err := memopayload.RebuildMemoPayload(i.ctx, memo, i.service.MarkdownService); err != nil {
		return nil, errors.Wrap(err, "failed to rebuild memo payload")
	}
	if record.Location != nil {
		memo.Payload.Location = &storepb.MemoPayload_Location{
			Placeholder: record.Location.Placeholder,
			Latitude:    record.Location.Latitude,
			Longitude:   record.Location.Longitude,
		}
	}
	return memo, nil
}

// resolveSpace matches a record's Space by UID, then by title, among the
// Spaces the importing user is an active member of.
func (i *memoImporter) resolveSpace(space *memoexport.Space) (*int32, error) {
	if cached, ok := i.spaces[space.UID]; ok {
		return cached, nil
	}
	if i.memberSpaces == nil {
		memberSpaces, err := i.service.Store.ListSpaces(i.ctx, &store.FindSpace{MemberUserID: &i.user.ID})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list spaces")
		}
		i.memberSpaces = memberSpaces
	}
	var resolved *int32
	for _, match := range []func(*store.Space) bool{
		func(candidate *store.Space) bool { return candidate.UID == space.UID },
		func(candidate *store.Space) bool { return space.Title != "" && candidate.Title == space.Title },
	} {
		for _, candidate := range i.memberSpaces {
			if candidate.CurrentUserRole.IsActiveMember() && match(candidate) {
				resolved = &candidate.ID
				break
			}
		}
		if resolved != nil {
			break
		}
	}
	i.spaces[space.UID] = resolved
	return resolved, nil
}

// resolveMemo finds the instance memo an archive UID refers to: one this run
// has already placed, or one on the instance the user may read.
func (i *memoImporter) resolveMemo(uid string) (*store.Memo, error) {
	if memo, ok := i.resolved[uid]; ok {
		return memo, nil
	}
	memo, err := i.service.Store.GetMemo(i.ctx, &store.FindMemo{UID: &uid, Access: newMemoAccessScope(i.user, true)})
	if err != nil {
		return nil, errors.Wrap(err, "failed to look up memo")
	}
	return memo, nil
}

// importAttachments creates the attachments of a record that the memo does
// not already hold and returns their names for binding.
func (i *memoImporter) importAttachments(record *memoexport.Memo, current []*store.Attachment) ([]*v1pb.Attachment, error) {
	bound := make(map[string]struct{}, len(current))
	for _, attachment := range current {
		bound[attachment.UID] = struct{}{}
	}
	toBind := make([]*v1pb.Attachment, 0, len(record.Attachments))
	// created holds only attachments this run stored; a pre-existing
	// attachment that is merely re-bound is never discarded on failure.
	created := make([]*v1pb.Attachment, 0, len(record.Attachments))
	for index := range record.Attachments {
		entry := &record.Attachments[index]
		if _, ok := bound[entry.UID]; ok {
			continue
		}
		name, stored, err := i.importAttachment(entry)
		if err != nil {
			i.discardAttachments(created)
			return nil, errors.Wrapf(err, "attachment %s", entry.UID)
		}
		attachment := &v1pb.Attachment{Name: name}
		toBind = append(toBind, attachment)
		if stored {
			created = append(created, attachment)
			// Stored bytes count against the same upload budget as an upload.
			i.service.charge(ratelimit.ScopeUploadUser, userKey(i.user.ID), 1)
		}
	}
	return toBind, nil
}

// importAttachment stores one attachment entry and returns the resource name
// to bind, and whether this run stored a new attachment for it.
func (i *memoImporter) importAttachment(entry *memoexport.Attachment) (string, bool, error) {
	mimeType, ok := normalizeMimeType(entry.Type)
	if !ok {
		return "", false, errors.Errorf("invalid media type %q", entry.Type)
	}
	if !validateFilename(entry.Filename) {
		return "", false, errors.New("filename contains invalid characters")
	}
	uid, err := i.resolveAttachmentUID(entry)
	if err != nil {
		return "", false, err
	}
	if uid == "" {
		// An identical unlinked attachment already belongs to the user.
		return AttachmentNamePrefix + entry.UID, false, nil
	}
	name, err := i.storeAttachment(entry, uid, mimeType)
	if err != nil {
		return "", false, err
	}
	return name, true, nil
}

// storeAttachment writes a new attachment for the entry under uid.
func (i *memoImporter) storeAttachment(entry *memoexport.Attachment, uid, mimeType string) (string, error) {
	if entry.ExternalLink != "" {
		attachment, err := i.service.Store.CreateAttachment(i.ctx, &store.Attachment{
			UID:         uid,
			CreatorID:   i.user.ID,
			Filename:    entry.Filename,
			Type:        mimeType,
			Size:        entry.Size,
			StorageType: storepb.AttachmentStorageType_EXTERNAL,
			Reference:   entry.ExternalLink,
		})
		if err != nil {
			return "", errors.Wrap(err, "failed to create external attachment")
		}
		return AttachmentNamePrefix + attachment.UID, nil
	}
	if err := checkUploadSize(i.storageSetting, entry.Size); err != nil {
		return "", err
	}
	data, err := i.archive.ReadAttachment(entry)
	if err != nil {
		return "", err
	}
	create := &store.Attachment{
		UID:       uid,
		CreatorID: i.user.ID,
		Filename:  entry.Filename,
		Type:      mimeType,
		Size:      int64(len(data)),
	}
	if len(entry.MediaMetadata) > 0 {
		metadata := &v1pb.MediaMetadata{}
		if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(entry.MediaMetadata, metadata); err != nil {
			i.warn("", fmt.Sprintf("attachment %s: media metadata was not understood and was dropped", entry.UID))
		} else if stored, err := validateClientMediaMetadata(metadata, mimeType); err != nil {
			i.warn("", fmt.Sprintf("attachment %s: media metadata was rejected and dropped: %v", entry.UID, err))
		} else if stored != nil {
			create.Payload = ensureAttachmentPayload(create.Payload)
			create.Payload.MediaMetadata = stored
		}
	}
	attachment, err := i.service.processAndSaveAttachment(i.ctx, create, i.storageSetting, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	return attachment.Name, nil
}

// resolveAttachmentUID decides which UID a new attachment gets. It returns
// the empty string when an unlinked attachment with the same UID, owner, and
// bytes already exists and should simply be bound.
func (i *memoImporter) resolveAttachmentUID(entry *memoexport.Attachment) (string, error) {
	existing, err := i.service.Store.GetAttachment(i.ctx, &store.FindAttachment{UID: &entry.UID})
	if err != nil {
		return "", errors.Wrap(err, "failed to look up attachment")
	}
	if existing == nil {
		return entry.UID, nil
	}
	if entry.Path != "" && existing.CreatorID == i.user.ID && existing.MemoID == nil && existing.Size == entry.Size &&
		existing.StorageType != storepb.AttachmentStorageType_EXTERNAL {
		if digest, err := i.storedAttachmentDigest(existing); err == nil && digest == entry.SHA256 {
			return "", nil
		}
	}
	return shortuuid.New(), nil
}

// storedAttachmentDigest streams an attachment from storage and returns its
// lowercase hexadecimal SHA-256.
func (i *memoImporter) storedAttachmentDigest(attachment *store.Attachment) (string, error) {
	content, err := i.service.openAttachmentContent(i.ctx, attachment)
	if err != nil {
		return "", err
	}
	defer content.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, content); err != nil {
		return "", err
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

// discardAttachments removes attachments this run created for a memo that
// then failed, so no orphan uploads are left behind.
func (i *memoImporter) discardAttachments(attachments []*v1pb.Attachment) {
	for _, attachment := range attachments {
		uid, err := ExtractAttachmentUIDFromName(attachment.Name)
		if err != nil {
			continue
		}
		stored, err := i.service.Store.GetAttachment(i.ctx, &store.FindAttachment{UID: &uid})
		if err != nil || stored == nil || stored.CreatorID != i.user.ID || stored.MemoID != nil {
			continue
		}
		if err := i.service.Store.DeleteAttachments(i.ctx, []*store.Attachment{stored}); err != nil {
			slog.Warn("failed to discard attachment after import failure", slog.String("uid", uid), slog.Any("error", err))
		}
	}
}

// applyRelations replaces the memo's REFERENCE relations with those from the
// record, skipping targets that exist neither in the archive nor on the
// instance.
func (i *memoImporter) applyRelations(written writtenMemo) error {
	record := written.record
	if len(record.Relations) == 0 {
		return nil
	}
	// Reload so the optimistic content check sees the memo as written.
	memo, err := i.service.Store.GetMemo(i.ctx, &store.FindMemo{ID: &written.memo.ID})
	if err != nil {
		return errors.Wrap(err, "failed to reload memo")
	}
	if memo == nil {
		return errors.New("memo disappeared during import")
	}
	relations := make([]*store.MemoRelation, 0, len(record.Relations))
	seen := map[int32]struct{}{memo.ID: {}}
	for _, relation := range record.Relations {
		target, err := i.resolveMemo(relation.Memo)
		if err != nil {
			return err
		}
		if target == nil {
			i.warn(record.UID, fmt.Sprintf("referenced memo %s was not found; the reference was dropped", relation.Memo))
			continue
		}
		if _, dup := seen[target.ID]; dup {
			continue
		}
		seen[target.ID] = struct{}{}
		relations = append(relations, &store.MemoRelation{MemoID: memo.ID, RelatedMemoID: target.ID, Type: store.MemoRelationReference})
	}
	if len(relations) == 0 {
		return nil
	}
	return i.service.applyMemoMutation(i.ctx, memo, nil, nil, nil, &relations)
}
