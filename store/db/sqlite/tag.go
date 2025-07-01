package sqlite

import (
	"context"
	"strings"
	"time"

	"github.com/usememos/memos/store"
)

func (d *DB) UpdateTag(ctx context.Context, update *store.UpdateTag) (*store.Tag, error) {
	// Check if tag exists
	existing, err := d.getTag(ctx, update.TagHash, update.CreatorID)
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()

	if existing == nil {
		// Insert new tag
		fields := []string{"`creator_id`", "`tag_hash`", "`tag_name`", "`emoji`", "`pinned_ts`", "`created_ts`", "`updated_ts`"}
		placeholder := []string{"?", "?", "?", "?", "?", "?", "?"}
		args := []interface{}{update.CreatorID, update.TagHash}

		// Handle optional fields
		if update.TagName != nil {
			args = append(args, *update.TagName)
		} else {
			args = append(args, "")
		}

		if update.Emoji != nil {
			args = append(args, *update.Emoji)
		} else {
			args = append(args, "")
		}

		if update.PinnedTs != nil {
			args = append(args, *update.PinnedTs)
		} else {
			args = append(args, nil)
		}

		args = append(args, now, now)

		stmt := "INSERT INTO `tag` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`"
		var id int32
		if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&id); err != nil {
			return nil, err
		}

		return &store.Tag{
			ID:        id,
			CreatedTs: now,
			UpdatedTs: now,
			CreatorID: update.CreatorID,
			TagHash:   update.TagHash,
			TagName:   *update.TagName,
			Emoji: func() string {
				if update.Emoji != nil {
					return *update.Emoji
				}
				return ""
			}(),
			PinnedTs: update.PinnedTs,
		}, nil
	} else {
		// Update existing tag
		sets := []string{"`updated_ts` = ?"}
		args := []interface{}{now}

		if update.TagName != nil {
			sets = append(sets, "`tag_name` = ?")
			args = append(args, *update.TagName)
		}

		if update.Emoji != nil {
			sets = append(sets, "`emoji` = ?")
			args = append(args, *update.Emoji)
		}

		if update.PinnedTs != nil {
			sets = append(sets, "`pinned_ts` = ?")
			args = append(args, *update.PinnedTs)
		}

		args = append(args, existing.ID)

		stmt := "UPDATE `tag` SET " + strings.Join(sets, ", ") + " WHERE `id` = ?"
		if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
			return nil, err
		}

		// Return updated tag
		return d.getTagByID(ctx, existing.ID)
	}
}

func (d *DB) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
	}
	if find.TagHash != nil {
		where, args = append(where, "`tag_hash` = ?"), append(args, *find.TagHash)
	}
	if find.TagName != nil {
		where, args = append(where, "`tag_name` = ?"), append(args, *find.TagName)
	}
	if find.OnlyPinned != nil && *find.OnlyPinned {
		where = append(where, "`pinned_ts` IS NOT NULL")
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			created_ts,
			updated_ts,
			creator_id,
			tag_hash,
			tag_name,
			emoji,
			pinned_ts
		FROM tag
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY pinned_ts DESC, updated_ts DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Tag{}
	for rows.Next() {
		tag := &store.Tag{}
		var pinnedTs interface{}
		if err := rows.Scan(
			&tag.ID,
			&tag.CreatedTs,
			&tag.UpdatedTs,
			&tag.CreatorID,
			&tag.TagHash,
			&tag.TagName,
			&tag.Emoji,
			&pinnedTs,
		); err != nil {
			return nil, err
		}

		if pinnedTs != nil {
			if ts, ok := pinnedTs.(int64); ok {
				tag.PinnedTs = &ts
			}
		}

		list = append(list, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

// Helper functions
func (d *DB) getTag(ctx context.Context, tagHash string, creatorID int32) (*store.Tag, error) {
	find := &store.FindTag{
		TagHash:   &tagHash,
		CreatorID: &creatorID,
	}
	tags, err := d.ListTags(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return nil, nil
	}
	return tags[0], nil
}

func (d *DB) getTagByID(ctx context.Context, id int32) (*store.Tag, error) {
	find := &store.FindTag{
		ID: &id,
	}
	tags, err := d.ListTags(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return nil, nil
	}
	return tags[0], nil
}
