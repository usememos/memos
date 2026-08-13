// Package fakes3 provides an in-process S3-compatible service for tests.
package fakes3

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/johannesboyne/gofakes3"
	"github.com/johannesboyne/gofakes3/backend/s3mem"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Server is an in-memory S3-compatible HTTP service.
type Server struct {
	URL string

	memory *s3mem.Backend
}

// New starts an in-process S3 service with the requested buckets.
func New(t testing.TB, buckets ...string) *Server {
	t.Helper()

	memory := s3mem.New()
	for _, bucket := range buckets {
		if err := memory.CreateBucket(bucket); err != nil {
			t.Fatalf("failed to create fake S3 bucket %q: %v", bucket, err)
		}
	}

	httpServer := httptest.NewServer(gofakes3.New(memory).Server())
	t.Cleanup(httpServer.Close)
	return &Server{
		URL:    httpServer.URL,
		memory: memory,
	}
}

// Config returns a storage configuration that connects to the fake service.
func (s *Server) Config(bucket string) *storepb.StorageS3Config {
	return &storepb.StorageS3Config{
		AccessKeyId:     "test-access-key",
		AccessKeySecret: "test-secret-key",
		Endpoint:        s.URL,
		Region:          "us-east-1",
		Bucket:          bucket,
		UsePathStyle:    true,
	}
}

// GetObject reads an object directly from the in-memory store.
func (s *Server) GetObject(bucket, key string) ([]byte, error) {
	object, err := s.memory.GetObject(bucket, key, nil)
	if err != nil {
		return nil, err
	}
	defer object.Contents.Close()
	return io.ReadAll(object.Contents)
}
