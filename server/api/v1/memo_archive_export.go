package v1

import (
	"context"
	"io"
	"maps"
	"slices"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/core/memoarchive"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// archiveQueryChunk bounds the number of IDs placed in one IN clause.
const archiveQueryChunk = 500

// memoArchiveExport gathers everything one user's archive needs before any
// entry is written, so the manifest can carry accurate counts.
type memoArchiveExport struct {
	memos            []*store.Memo
	attachmentsByID  map[int32][]*store.Attachment
	relatedIDsByID   map[int32][]int32
	reactionsByID    map[int32][]*store.Reaction
	spacesByID       map[int32]*store.Space
	memoUIDs         map[int32]string
	usernames        map[int32]string
	attachmentsCount int
}

// ExportMemoArchive writes a Memo Archive holding every memo the user
// created, including comments and archived memos, and the attachments linked
// to them. Nothing another user created is included.
func (s *APIV1Service) ExportMemoArchive(ctx context.Context, user *store.User, w io.Writer) error {
	if user == nil {
		return errors.New("user is required")
	}
	export, err := s.loadMemoArchiveExport(ctx, user)
	if err != nil {
		return err
	}

	exportTime := time.Now().UTC().Truncate(time.Second)
	writer := memoarchive.NewWriter(w, exportTime)
	if err := writer.WriteManifest(&memoarchive.Manifest{
		Generator:  memoarchive.Generator{Name: "memos", Version: s.Profile.Version},
		ExportTime: memoarchive.FormatTime(exportTime.Unix()),
		Scope: memoarchive.Scope{
			Kind: memoarchive.ScopeKindUser,
			User: &memoarchive.ScopeUser{Username: user.Username, DisplayName: user.Nickname},
		},
		Counts: &memoarchive.Counts{Memos: len(export.memos), Attachments: export.attachmentsCount},
	}); err != nil {
		return err
	}

	for _, memo := range export.memos {
		record, err := s.buildMemoArchiveRecord(ctx, writer, user, export, memo)
		if err != nil {
			return err
		}
		if err := writer.WriteMemo(record, []byte(memo.Content)); err != nil {
			return err
		}
	}
	return writer.Close()
}

func (s *APIV1Service) loadMemoArchiveExport(ctx context.Context, user *store.User) (*memoArchiveExport, error) {
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &user.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memos")
	}
	export := &memoArchiveExport{
		memos:           memos,
		attachmentsByID: make(map[int32][]*store.Attachment),
		relatedIDsByID:  make(map[int32][]int32),
		reactionsByID:   make(map[int32][]*store.Reaction),
		spacesByID:      make(map[int32]*store.Space),
		memoUIDs:        make(map[int32]string),
		usernames:       map[int32]string{user.ID: user.Username},
	}
	memoIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		memoIDs = append(memoIDs, memo.ID)
		export.memoUIDs[memo.ID] = memo.UID
		if memo.SpaceID != nil {
			if _, ok := export.spacesByID[*memo.SpaceID]; !ok {
				space, err := s.Store.GetSpace(ctx, &store.FindSpace{ID: memo.SpaceID})
				if err != nil {
					return nil, errors.Wrap(err, "failed to get space")
				}
				export.spacesByID[*memo.SpaceID] = space
			}
		}
	}

	foreignMemoIDs := make(map[int32]struct{})
	reactorIDs := make(map[int32]struct{})
	relationType := store.MemoRelationReference
	for chunk := range slices.Chunk(memoIDs, archiveQueryChunk) {
		attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: chunk})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list attachments")
		}
		for _, attachment := range attachments {
			if attachment.MemoID == nil {
				continue
			}
			export.attachmentsByID[*attachment.MemoID] = append(export.attachmentsByID[*attachment.MemoID], attachment)
			if attachment.StorageType != storepb.AttachmentStorageType_EXTERNAL {
				export.attachmentsCount++
			}
		}

		relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{MemoIDList: chunk, Type: &relationType})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list memo relations")
		}
		for _, relation := range relations {
			// MemoIDList matches either endpoint; only outgoing relations from
			// the user's own memos belong to their records.
			if _, own := export.memoUIDs[relation.MemoID]; !own {
				continue
			}
			export.relatedIDsByID[relation.MemoID] = append(export.relatedIDsByID[relation.MemoID], relation.RelatedMemoID)
			if _, own := export.memoUIDs[relation.RelatedMemoID]; !own {
				foreignMemoIDs[relation.RelatedMemoID] = struct{}{}
			}
		}

		reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{MemoIDList: chunk})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list reactions")
		}
		for _, reaction := range reactions {
			export.reactionsByID[reaction.MemoID] = append(export.reactionsByID[reaction.MemoID], reaction)
			if reaction.CreatorID != user.ID {
				reactorIDs[reaction.CreatorID] = struct{}{}
			}
		}
	}

	for chunk := range slices.Chunk(slices.Sorted(maps.Keys(foreignMemoIDs)), archiveQueryChunk) {
		related, err := s.Store.ListMemos(ctx, &store.FindMemo{IDList: chunk, ExcludeContent: true})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list related memos")
		}
		for _, memo := range related {
			export.memoUIDs[memo.ID] = memo.UID
		}
	}
	for chunk := range slices.Chunk(slices.Sorted(maps.Keys(reactorIDs)), archiveQueryChunk) {
		users, err := s.Store.ListUsers(ctx, &store.FindUser{IDList: chunk})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list users")
		}
		for _, reactor := range users {
			export.usernames[reactor.ID] = reactor.Username
		}
	}
	return export, nil
}

func (s *APIV1Service) buildMemoArchiveRecord(ctx context.Context, writer *memoarchive.Writer, user *store.User, export *memoArchiveExport, memo *store.Memo) (*memoarchive.Memo, error) {
	record := &memoarchive.Memo{
		UID:        memo.UID,
		Creator:    user.Username,
		CreateTime: memoarchive.FormatTime(memo.CreatedTs),
		UpdateTime: memoarchive.FormatTime(memo.UpdatedTs),
		State:      string(memo.RowStatus),
		Visibility: memo.Visibility.String(),
		Pinned:     memo.Pinned,
		Tags:       memo.Payload.GetTags(),
	}
	if location := memo.Payload.GetLocation(); location != nil {
		record.Location = &memoarchive.Location{
			Placeholder: location.Placeholder,
			Latitude:    location.Latitude,
			Longitude:   location.Longitude,
		}
	}
	if memo.SpaceID != nil {
		if space := export.spacesByID[*memo.SpaceID]; space != nil {
			record.Space = &memoarchive.Space{UID: space.UID, Title: space.Title}
		}
	}
	if memo.ParentUID != nil && *memo.ParentUID != "" {
		record.Parent = *memo.ParentUID
	}
	for _, relatedID := range export.relatedIDsByID[memo.ID] {
		uid, ok := export.memoUIDs[relatedID]
		if !ok {
			continue
		}
		record.Relations = append(record.Relations, memoarchive.Relation{Type: memoarchive.RelationReference, Memo: uid})
	}
	for _, reaction := range export.reactionsByID[memo.ID] {
		username, ok := export.usernames[reaction.CreatorID]
		if !ok {
			continue
		}
		record.Reactions = append(record.Reactions, memoarchive.Reaction{
			ReactionType: reaction.ReactionType,
			Creator:      username,
			CreateTime:   memoarchive.FormatTime(reaction.CreatedTs),
		})
	}
	for _, attachment := range export.attachmentsByID[memo.ID] {
		entry := memoarchive.Attachment{
			UID:        attachment.UID,
			Filename:   attachment.Filename,
			Type:       attachment.Type,
			Size:       attachment.Size,
			CreateTime: memoarchive.FormatTime(attachment.CreatedTs),
		}
		if metadata := convertMediaMetadataFromStore(attachment.Payload.GetMediaMetadata()); metadata != nil {
			raw, err := protojson.Marshal(metadata)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to encode media metadata of attachment %s", attachment.UID)
			}
			entry.MediaMetadata = raw
		}
		if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
			entry.ExternalLink = attachment.Reference
		} else {
			content, err := s.openAttachmentContent(ctx, attachment)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to read attachment %s", attachment.UID)
			}
			entry.Path = memoarchive.AttachmentPath(attachment.UID, attachment.Filename)
			digest, size, err := writer.WriteAttachment(entry.Path, content)
			_ = content.Close()
			if err != nil {
				return nil, err
			}
			entry.SHA256 = digest
			entry.Size = size
		}
		record.Attachments = append(record.Attachments, entry)
	}
	return record, nil
}
