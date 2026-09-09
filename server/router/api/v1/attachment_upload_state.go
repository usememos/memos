package v1

import (
	"crypto/rand"
	"crypto/sha256"
	"os"
	"path/filepath"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

const (
	attachmentUploadChunkSize        = 2 << 20
	attachmentUploadRequestLimit     = 4 << 20
	attachmentUploadMetadataLimit    = 64 << 10
	attachmentUploadTTL              = 30 * time.Minute
	attachmentUploadMaxSessions      = 1024
	attachmentUploadMaxActive        = 128
	attachmentUploadMaxActivePerUser = 8
	attachmentUploadTempPrefix       = ".memos-rpc-upload-"
	attachmentUploadProcedure        = "/memos.api.v1.AttachmentService/UploadAttachment"
)

// Upload state is private to the process; only Attachment is an API resource.
// Each upload holds metadata and the last chunk's digest, never its contents.
type attachmentUpload struct {
	mu            sync.Mutex
	ownerID       int32
	metadata      *v1pb.Attachment
	uid           string
	path          string
	totalSize     int64
	committedSize int64
	// expireTime is zeroed to revoke an upload before its TTL elapses.
	expireTime time.Time
	// lastDigest identifies the most recently accepted chunk so a client can
	// safely resend it after losing the response.
	lastDigest        [sha256.Size]byte
	finalizeAttempted bool
	complete          bool
}

type attachmentUploads struct {
	mu      sync.Mutex
	entries map[string]*attachmentUpload
	stop    chan struct{}
	done    chan struct{}
	closed  bool
}

func (m *attachmentUploads) startLocked(dir string) {
	if m.entries != nil {
		return
	}
	m.entries = make(map[string]*attachmentUpload)
	m.stop = make(chan struct{})
	m.done = make(chan struct{})
	go func() {
		defer close(m.done)
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-m.stop:
				return
			case now := <-ticker.C:
				m.mu.Lock()
				m.sweepLocked(now, 0)
				m.removeOrphansLocked(dir, now)
				m.mu.Unlock()
			}
		}
	}()
}

// sweepLocked drops expired uploads and counts the unfinished ones, both in
// total and for ownerID. An upload locked by an in-flight request is
// unfinished by definition.
func (m *attachmentUploads) sweepLocked(now time.Time, ownerID int32) (owned, total int) {
	count := func(upload *attachmentUpload) {
		total++
		if upload.ownerID == ownerID {
			owned++
		}
	}
	for id, upload := range m.entries {
		// Never hold the manager lock while waiting for a file write or finalize.
		if !upload.mu.TryLock() {
			count(upload)
			continue
		}
		if !now.Before(upload.expireTime) {
			os.Remove(upload.path)
			delete(m.entries, id)
		} else if !upload.complete {
			count(upload)
		}
		upload.mu.Unlock()
	}
	return owned, total
}

func (m *attachmentUploads) removeOrphansLocked(dir string, now time.Time) {
	tracked := make(map[string]bool, len(m.entries))
	for _, upload := range m.entries {
		tracked[upload.path] = true // path is immutable after insertion.
	}
	paths, _ := filepath.Glob(filepath.Join(dir, attachmentUploadTempPrefix+"*"))
	for _, path := range paths {
		if tracked[path] {
			continue
		}
		if info, err := os.Stat(path); err == nil && info.Mode().IsRegular() && now.Sub(info.ModTime()) >= attachmentUploadTTL {
			os.Remove(path)
		}
	}
}

func (m *attachmentUploads) create(dir string, upload *attachmentUpload) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return "", status.Errorf(codes.Unavailable, "server is shutting down")
	}
	m.startLocked(dir)
	owned, total := m.sweepLocked(time.Now(), upload.ownerID)
	if owned >= attachmentUploadMaxActivePerUser {
		return "", status.Errorf(codes.ResourceExhausted, "too many active uploads")
	}
	if len(m.entries) >= attachmentUploadMaxSessions || total >= attachmentUploadMaxActive {
		return "", status.Errorf(codes.ResourceExhausted, "too many uploads")
	}
	file, err := os.CreateTemp(dir, attachmentUploadTempPrefix+"*")
	if err != nil {
		return "", status.Errorf(codes.Internal, "failed to create upload file: %v", err)
	}
	if err := file.Close(); err != nil {
		os.Remove(file.Name())
		return "", status.Errorf(codes.Internal, "failed to close upload file: %v", err)
	}
	upload.path = file.Name()
	upload.expireTime = time.Now().Add(attachmentUploadTTL)
	id := rand.Text()
	m.entries[id] = upload
	return id, nil
}

func (m *attachmentUploads) get(id string, ownerID int32) (*attachmentUpload, error) {
	m.mu.Lock()
	upload := m.entries[id]
	closed := m.closed
	m.mu.Unlock()
	if closed {
		return nil, status.Errorf(codes.Unavailable, "server is shutting down")
	}
	if upload == nil || upload.ownerID != ownerID {
		return nil, status.Errorf(codes.NotFound, "upload not found or expired")
	}
	return upload, nil
}

// CloseAttachmentUploads stops expiration work and removes pending upload files.
// Call it after draining HTTP requests during server shutdown.
func (s *APIV1Service) CloseAttachmentUploads() {
	m := &s.attachmentUploads
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	if m.stop != nil {
		close(m.stop)
	}
	done := m.done
	m.mu.Unlock()
	if done != nil {
		<-done
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, upload := range m.entries {
		upload.mu.Lock()
		upload.expireTime = time.Time{}
		os.Remove(upload.path)
		upload.mu.Unlock()
		delete(m.entries, id)
	}
}
