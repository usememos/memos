package v1

import (
	"crypto/rand"
	"crypto/sha256"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Limits shared by every chunked upload RPC.
const (
	uploadChunkSize        = 2 << 20
	uploadRequestLimit     = 4 << 20
	uploadTTL              = 30 * time.Minute
	uploadMaxSessions      = 1024
	uploadMaxActive        = 128
	uploadMaxActivePerUser = 8
)

// uploadSession is one chunked upload staged in a temporary file. Upload
// state is private to the process. A session holds the last chunk's digest,
// never its contents, plus a kind-specific state T.
type uploadSession[T any] struct {
	mu            sync.Mutex
	ownerID       int32
	path          string
	totalSize     int64
	committedSize int64
	// expireTime is zeroed to revoke an upload before its TTL elapses.
	expireTime time.Time
	// lastDigest identifies the most recently accepted chunk so a client can
	// safely resend it after losing the response.
	lastDigest [sha256.Size]byte
	complete   bool
	state      T
}

// write appends one chunk at writeOffset. With no data and finishWrite
// false it only reports progress. finishWrite requires the committed size to
// equal the total size once the data is written.
func (u *uploadSession[T]) write(writeOffset int64, data []byte, finishWrite bool) error {
	if len(data) == 0 {
		if finishWrite && writeOffset != u.committedSize {
			return status.Errorf(codes.OutOfRange, "write_offset must equal committed_size")
		}
		return nil
	}
	digest := sha256.Sum256(data)
	if u.committedSize > 0 && writeOffset+int64(len(data)) == u.committedSize && digest == u.lastDigest {
		return nil // A lost response can be retried without appending bytes twice.
	}
	if u.complete {
		return status.Errorf(codes.FailedPrecondition, "upload is already complete")
	}
	if writeOffset != u.committedSize {
		return status.Errorf(codes.OutOfRange, "write_offset must equal committed_size")
	}
	if int64(len(data)) > u.totalSize-u.committedSize {
		return status.Errorf(codes.InvalidArgument, "data exceeds total_size")
	}
	file, err := os.OpenFile(u.path, os.O_WRONLY, 0600)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open upload file: %v", err)
	}
	defer file.Close()
	n, err := file.WriteAt(data, u.committedSize)
	if err == nil && n != len(data) {
		err = io.ErrShortWrite
	}
	if err != nil {
		return status.Errorf(codes.Internal, "failed to write upload file: %v", err)
	}
	if err := file.Sync(); err != nil {
		return status.Errorf(codes.Internal, "failed to sync upload file: %v", err)
	}
	u.committedSize += int64(len(data))
	u.lastDigest = digest
	return nil
}

// uploadSessions tracks the sessions of one upload kind, sweeps expired ones
// and orphaned files under its temp prefix, and bounds how many are active.
type uploadSessions[T any] struct {
	mu      sync.Mutex
	prefix  string
	entries map[string]*uploadSession[T]
	stop    chan struct{}
	done    chan struct{}
	closed  bool
}

func (m *uploadSessions[T]) startLocked(dir, prefix string) {
	if m.entries != nil {
		return
	}
	m.prefix = prefix
	m.entries = make(map[string]*uploadSession[T])
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
func (m *uploadSessions[T]) sweepLocked(now time.Time, ownerID int32) (owned, total int) {
	count := func(upload *uploadSession[T]) {
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

func (m *uploadSessions[T]) removeOrphansLocked(dir string, now time.Time) {
	tracked := make(map[string]bool, len(m.entries))
	for _, upload := range m.entries {
		tracked[upload.path] = true // path is immutable after insertion.
	}
	paths, _ := filepath.Glob(filepath.Join(dir, m.prefix+"*"))
	for _, path := range paths {
		if tracked[path] {
			continue
		}
		if info, err := os.Stat(path); err == nil && info.Mode().IsRegular() && now.Sub(info.ModTime()) >= uploadTTL {
			os.Remove(path)
		}
	}
}

// create registers a new session for ownerID with totalSize bytes to come,
// backed by a temp file under dir named with prefix, and returns its id.
func (m *uploadSessions[T]) create(dir, prefix string, ownerID int32, totalSize int64, state T) (string, *uploadSession[T], error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return "", nil, status.Errorf(codes.Unavailable, "server is shutting down")
	}
	m.startLocked(dir, prefix)
	owned, total := m.sweepLocked(time.Now(), ownerID)
	if owned >= uploadMaxActivePerUser {
		return "", nil, status.Errorf(codes.ResourceExhausted, "too many active uploads")
	}
	if len(m.entries) >= uploadMaxSessions || total >= uploadMaxActive {
		return "", nil, status.Errorf(codes.ResourceExhausted, "too many uploads")
	}
	file, err := os.CreateTemp(dir, prefix+"*")
	if err != nil {
		return "", nil, status.Errorf(codes.Internal, "failed to create upload file: %v", err)
	}
	if err := file.Close(); err != nil {
		os.Remove(file.Name())
		return "", nil, status.Errorf(codes.Internal, "failed to close upload file: %v", err)
	}
	upload := &uploadSession[T]{
		ownerID:    ownerID,
		path:       file.Name(),
		totalSize:  totalSize,
		expireTime: time.Now().Add(uploadTTL),
		state:      state,
	}
	id := rand.Text()
	m.entries[id] = upload
	return id, upload, nil
}

func (m *uploadSessions[T]) get(id string, ownerID int32) (*uploadSession[T], error) {
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

// resume looks up and locks the session for a continuing call. The caller
// unlocks it.
func (m *uploadSessions[T]) resume(id string, ownerID int32) (*uploadSession[T], error) {
	upload, err := m.get(id, ownerID)
	if err != nil {
		return nil, err
	}
	upload.mu.Lock()
	if !time.Now().Before(upload.expireTime) {
		upload.mu.Unlock()
		return nil, status.Errorf(codes.NotFound, "upload not found or expired")
	}
	return upload, nil
}

// close stops expiration work and removes pending upload files.
func (m *uploadSessions[T]) close() {
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

// CloseUploads stops every upload manager and removes pending upload files.
// Call it after draining HTTP requests during server shutdown.
func (s *APIV1Service) CloseUploads() {
	s.attachmentUploads.close()
	s.memoImports.close()
}
