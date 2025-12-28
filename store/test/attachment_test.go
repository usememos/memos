package test

import (
	"context"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestAttachmentStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.epub",
		Blob:      []byte("test"),
		Type:      "application/epub+zip",
		Size:      637607,
	})
	require.NoError(t, err)

	correctFilename := "test.epub"
	incorrectFilename := "test.png"
	attachment, err := ts.GetAttachment(ctx, &store.FindAttachment{
		Filename: &correctFilename,
	})
	require.NoError(t, err)
	require.Equal(t, correctFilename, attachment.Filename)
	require.Equal(t, int32(1), attachment.ID)

	notFoundAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{
		Filename: &incorrectFilename,
	})
	require.NoError(t, err)
	require.Nil(t, notFoundAttachment)

	var correctCreatorID int32 = 101
	var incorrectCreatorID int32 = 102
	_, err = ts.GetAttachment(ctx, &store.FindAttachment{
		CreatorID: &correctCreatorID,
	})
	require.NoError(t, err)

	notFoundAttachment, err = ts.GetAttachment(ctx, &store.FindAttachment{
		CreatorID: &incorrectCreatorID,
	})
	require.NoError(t, err)
	require.Nil(t, notFoundAttachment)

	err = ts.DeleteAttachment(ctx, &store.DeleteAttachment{
		ID: 1,
	})
	require.NoError(t, err)
	err = ts.DeleteAttachment(ctx, &store.DeleteAttachment{
		ID: 2,
	})
	require.ErrorContains(t, err, "attachment not found")
	ts.Close()
}

func TestAttachmentStoreWithFilter(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.png",
		Blob:      []byte("test"),
		Type:      "image/png",
		Size:      1000,
	})
	require.NoError(t, err)

	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.jpg",
		Blob:      []byte("test"),
		Type:      "image/jpeg",
		Size:      2000,
	})
	require.NoError(t, err)

	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.pdf",
		Blob:      []byte("test"),
		Type:      "application/pdf",
		Size:      3000,
	})
	require.NoError(t, err)

	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`mime_type == "image/png"`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	require.Equal(t, "image/png", attachments[0].Type)

	attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`mime_type in ["image/png", "image/jpeg"]`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 2)

	attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`filename.contains("test")`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 3)

	ts.Close()
}
