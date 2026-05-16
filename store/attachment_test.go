package store

import (
	"testing"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestAttachmentNeedsInstanceStorageSetting(t *testing.T) {
	tests := []struct {
		name       string
		attachment *Attachment
		want       bool
	}{
		{
			name: "nil attachment",
		},
		{
			name: "local attachment",
			attachment: &Attachment{
				StorageType: storepb.AttachmentStorageType_LOCAL,
			},
		},
		{
			name: "s3 attachment without payload",
			attachment: &Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
			},
		},
		{
			name: "s3 attachment with embedded config",
			attachment: &Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
				Payload: &storepb.AttachmentPayload{
					Payload: &storepb.AttachmentPayload_S3Object_{
						S3Object: &storepb.AttachmentPayload_S3Object{
							S3Config: &storepb.StorageS3Config{},
						},
					},
				},
			},
		},
		{
			name: "s3 attachment without embedded config",
			attachment: &Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
				Payload: &storepb.AttachmentPayload{
					Payload: &storepb.AttachmentPayload_S3Object_{
						S3Object: &storepb.AttachmentPayload_S3Object{},
					},
				},
			},
			want: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := AttachmentNeedsInstanceStorageSetting(test.attachment); got != test.want {
				t.Fatalf("AttachmentNeedsInstanceStorageSetting() = %v, want %v", got, test.want)
			}
		})
	}
}
