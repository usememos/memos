package s3presign

import (
	"context"
	"log/slog"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/plugin/storage/s3"
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
	workspaceStorageSetting, err := r.Store.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return
	}

	s3StorageType := storepb.ResourceStorageType_S3
	resources, err := r.Store.ListResources(ctx, &store.FindResource{
		GetBlob:     false,
		StorageType: &s3StorageType,
	})
	if err != nil {
		return
	}

	for _, resource := range resources {
		s3ObjectPayload := resource.Payload.GetS3Object()
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

		s3Config := workspaceStorageSetting.GetS3Config()
		if s3ObjectPayload.S3Config != nil {
			s3Config = s3ObjectPayload.S3Config
		}
		if s3Config == nil {
			slog.Error("S3 config is not found")
			continue
		}

		s3Client, err := s3.NewClient(ctx, s3Config)
		if err != nil {
			slog.Error("Failed to create S3 client", "error", err)
			continue
		}

		presignURL, err := s3Client.PresignGetObject(ctx, s3ObjectPayload.Key)
		if err != nil {
			return
		}
		s3ObjectPayload.S3Config = s3Config
		s3ObjectPayload.LastPresignedTime = timestamppb.New(time.Now())
		if err := r.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:        resource.ID,
			Reference: &presignURL,
			Payload: &storepb.ResourcePayload{
				Payload: &storepb.ResourcePayload_S3Object_{
					S3Object: s3ObjectPayload,
				},
			},
		}); err != nil {
			return
		}
	}
}
