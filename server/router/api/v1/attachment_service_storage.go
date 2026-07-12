package v1

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/storage/s3"
	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func convertAttachmentFromStore(attachment *store.Attachment) *v1pb.Attachment {
	attachmentMessage := &v1pb.Attachment{
		Name:        fmt.Sprintf("%s%s", AttachmentNamePrefix, attachment.UID),
		CreateTime:  timestamppb.New(time.Unix(attachment.CreatedTs, 0)),
		Filename:    attachment.Filename,
		Type:        attachment.Type,
		Size:        attachment.Size,
		MotionMedia: convertMotionMediaFromStore(getAttachmentMotionMedia(attachment)),
	}
	if attachment.MemoUID != nil && *attachment.MemoUID != "" {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, *attachment.MemoUID)
		attachmentMessage.Memo = &memoName
	}
	if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL || attachment.StorageType == storepb.AttachmentStorageType_S3 {
		attachmentMessage.ExternalLink = attachment.Reference
	}

	return attachmentMessage
}

// SaveAttachmentBlob saves the blob of attachment based on the storage config.
func SaveAttachmentBlob(ctx context.Context, profile *profile.Profile, stores *store.Store, create *store.Attachment) error {
	instanceStorageSetting, err := stores.GetInstanceStorageSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "Failed to find instance storage setting")
	}

	if instanceStorageSetting.StorageType == storepb.InstanceStorageSetting_LOCAL {
		filepathTemplate := "assets/{timestamp}_{uuid}_{filename}"
		if instanceStorageSetting.FilepathTemplate != "" {
			filepathTemplate = instanceStorageSetting.FilepathTemplate
		}

		internalPath := filepathTemplate
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replaceFilenameWithPathTemplate(internalPath, create.Filename)
		internalPath = filepath.ToSlash(internalPath)

		// Ensure the directory exists.
		osPath := filepath.FromSlash(internalPath)
		if !filepath.IsAbs(osPath) {
			osPath = filepath.Join(profile.Data, osPath)
		}
		osPath = ensureUniqueLocalAttachmentPath(osPath, create.UID)
		internalPath = filepath.ToSlash(osPath)
		if !filepath.IsAbs(filepath.FromSlash(internalPath)) {
			internalPath, err = filepath.Rel(profile.Data, osPath)
			if err != nil {
				return errors.Wrap(err, "Failed to get relative path")
			}
			internalPath = filepath.ToSlash(internalPath)
		}
		dir := filepath.Dir(osPath)
		if err = os.MkdirAll(dir, os.ModePerm); err != nil {
			return errors.Wrap(err, "Failed to create directory")
		}

		// Write the blob to the file.
		if err := os.WriteFile(osPath, create.Blob, 0644); err != nil {
			return errors.Wrap(err, "Failed to write file")
		}
		create.Reference = internalPath
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_LOCAL
	} else if instanceStorageSetting.StorageType == storepb.InstanceStorageSetting_S3 {
		s3Config := instanceStorageSetting.S3Config
		if s3Config == nil {
			return errors.Errorf("No activated external storage found")
		}
		s3Client, err := s3.NewClient(ctx, s3Config)
		if err != nil {
			return errors.Wrap(err, "Failed to create s3 client")
		}

		filepathTemplate := instanceStorageSetting.FilepathTemplate
		if !strings.Contains(filepathTemplate, "{filename}") {
			filepathTemplate = filepath.Join(filepathTemplate, "{filename}")
		}
		filepathTemplate = replaceFilenameWithPathTemplate(filepathTemplate, create.Filename)
		key, err := s3Client.UploadObject(ctx, filepathTemplate, create.Type, bytes.NewReader(create.Blob))
		if err != nil {
			return errors.Wrap(err, "Failed to upload via s3 client")
		}
		presignURL, err := s3Client.PresignGetObject(ctx, key)
		if err != nil {
			return errors.Wrap(err, "Failed to presign via s3 client")
		}

		create.Reference = presignURL
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_S3
		payload := ensureAttachmentPayload(create.Payload)
		payload.Payload = &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				S3Config:          s3Config,
				Key:               key,
				LastPresignedTime: timestamppb.New(time.Now()),
			},
		}
		create.Payload = payload
	}

	return nil
}

func (s *APIV1Service) GetAttachmentBlob(attachment *store.Attachment) ([]byte, error) {
	// For local storage, read the file from the local disk.
	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		attachmentPath := filepath.FromSlash(attachment.Reference)
		if !filepath.IsAbs(attachmentPath) {
			attachmentPath = filepath.Join(s.Profile.Data, attachmentPath)
		}

		file, err := os.Open(attachmentPath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		defer file.Close()
		blob, err := io.ReadAll(file)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read the file")
		}
		return blob, nil
	}
	// For S3 storage, download the file from S3.
	if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		if attachment.Payload == nil {
			return nil, errors.New("attachment payload is missing")
		}
		s3Object := attachment.Payload.GetS3Object()
		if s3Object == nil {
			return nil, errors.New("S3 object payload is missing")
		}
		if s3Object.S3Config == nil {
			return nil, errors.New("S3 config is missing")
		}
		if s3Object.Key == "" {
			return nil, errors.New("S3 object key is missing")
		}

		s3Client, err := s3.NewClient(context.Background(), s3Object.S3Config)
		if err != nil {
			return nil, errors.Wrap(err, "failed to create S3 client")
		}

		blob, err := s3Client.GetObject(context.Background(), s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get object from S3")
		}
		return blob, nil
	}
	// For database storage, return the blob from the database.
	return attachment.Blob, nil
}

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func replaceFilenameWithPathTemplate(path, filename string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{filename}":
			return filename
		case "{timestamp}":
			return fmt.Sprintf("%d", t.Unix())
		case "{year}":
			return fmt.Sprintf("%d", t.Year())
		case "{month}":
			return fmt.Sprintf("%02d", t.Month())
		case "{day}":
			return fmt.Sprintf("%02d", t.Day())
		case "{hour}":
			return fmt.Sprintf("%02d", t.Hour())
		case "{minute}":
			return fmt.Sprintf("%02d", t.Minute())
		case "{second}":
			return fmt.Sprintf("%02d", t.Second())
		case "{uuid}":
			return util.GenUUID()
		default:
			return s
		}
	})
	return path
}

func ensureUniqueLocalAttachmentPath(path, uid string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	return base + "_" + uid + ext
}

func validateFilename(filename string) bool {
	// Reject path traversal attempts and make sure no additional directories are created
	if !filepath.IsLocal(filename) || strings.ContainsAny(filename, "/\\") {
		return false
	}

	// Reject filenames starting or ending with spaces or periods
	if strings.HasPrefix(filename, " ") || strings.HasSuffix(filename, " ") ||
		strings.HasPrefix(filename, ".") || strings.HasSuffix(filename, ".") {
		return false
	}

	return true
}

func normalizeMimeType(mimeType string) (string, bool) {
	mimeType = strings.TrimSpace(mimeType)
	if mimeType == "" || len(mimeType) > 255 {
		return "", false
	}

	mediaType, _, err := mime.ParseMediaType(mimeType)
	if err != nil || mediaType == "" || len(mediaType) > 255 {
		return "", false
	}

	return mediaType, true
}
