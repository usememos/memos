package s3presign

import (
	"context"
	"log/slog"
	"time"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/storage"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store *store.Store
}

func NewRunner(store *store.Store) *Runner {
	return &Runner{
		Store: store,
	}
}

// Schedule runner every 12 hours.
const runnerInterval = time.Hour * 12

func (r *Runner) Run(ctx context.Context) {
	ticker := time.NewTicker(runnerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.RunOnce(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) RunOnce(ctx context.Context) {
	r.CheckAndPresign(ctx)
}

func (r *Runner) CheckAndPresign(ctx context.Context) {
	instanceStorageSetting, err := r.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return
	}

	s3StorageType := storepb.AttachmentStorageType_S3
	// Most attachments reference the same configured storage, so reuse drivers
	// instead of building an S3 client per attachment.
	driversByStorageID := map[string]storage.Driver{}
	// Limit attachments to a reasonable batch size
	const batchSize = 100
	offset := 0

	for {
		limit := batchSize
		attachments, err := r.Store.ListAttachments(ctx, &store.FindAttachment{
			GetBlob:     false,
			StorageType: &s3StorageType,
			Limit:       &limit,
			Offset:      &offset,
		})
		if err != nil {
			slog.Error("Failed to list attachments for presigning", "error", err)
			return
		}

		// Break if no more attachments
		if len(attachments) == 0 {
			break
		}

		// Process batch of attachments
		presignCount := 0
		for _, attachment := range attachments {
			payload := cloneAttachmentPayload(attachment.Payload)
			s3ObjectPayload := payload.GetS3Object()
			if s3ObjectPayload == nil {
				continue
			}

			if s3ObjectPayload.LastPresignedTime != nil {
				// Skip if the presigned URL is still valid for the next 4 days.
				// The expiration time is set to 5 days.
				if time.Now().Before(s3ObjectPayload.LastPresignedTime.AsTime().Add(4 * 24 * time.Hour)) {
					continue
				}
			}

			driver := driversByStorageID[s3ObjectPayload.StorageId]
			if driver == nil || s3ObjectPayload.StorageId == "" {
				driver, err = store.ResolveStorageDriver(ctx, instanceStorageSetting, s3ObjectPayload.StorageId, s3ObjectPayload.S3Config)
				if err != nil {
					slog.Error("Failed to resolve storage driver", "error", err, "attachmentID", attachment.ID, "storageID", s3ObjectPayload.StorageId)
					continue
				}
				if s3ObjectPayload.StorageId != "" {
					driversByStorageID[s3ObjectPayload.StorageId] = driver
				}
			}

			presignURL, err := driver.PresignGetObject(ctx, s3ObjectPayload.Key)
			if err != nil {
				slog.Error("Failed to presign URL", "error", err, "attachmentID", attachment.ID)
				continue
			}

			s3ObjectPayload.LastPresignedTime = timestamppb.New(time.Now())
			if err := r.Store.UpdateAttachment(ctx, &store.UpdateAttachment{
				ID:        attachment.ID,
				Reference: &presignURL,
				Payload:   payload,
			}); err != nil {
				slog.Error("Failed to update attachment", "error", err, "attachmentID", attachment.ID)
				continue
			}
			presignCount++
		}

		slog.Info("Presigned batch of S3 attachments", "batchSize", len(attachments), "presigned", presignCount)

		// Move to next batch
		offset += len(attachments)
	}
}

func cloneAttachmentPayload(payload *storepb.AttachmentPayload) *storepb.AttachmentPayload {
	if payload == nil {
		return nil
	}
	cloned, ok := proto.Clone(payload).(*storepb.AttachmentPayload)
	if !ok {
		return nil
	}
	return cloned
}
