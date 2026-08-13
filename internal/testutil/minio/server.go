// Package minio provides a real S3-compatible service backed by a MinIO
// Testcontainer for integration tests.
package minio

import (
	"bytes"
	"context"
	"io"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcminio "github.com/testcontainers/testcontainers-go/modules/minio"

	storepb "github.com/usememos/memos/proto/gen/store"
)

const image = "minio/minio:RELEASE.2024-01-16T16-07-38Z"

// Server is an S3-compatible MinIO container with an AWS SDK client for
// arranging and inspecting test objects.
type Server struct {
	Endpoint string
	Region   string
	Username string
	Password string

	client *awss3.Client
}

// New starts a MinIO container and creates the requested buckets.
func New(t *testing.T, buckets ...string) *Server {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping MinIO integration test in short mode")
	}
	if os.Getenv("SKIP_CONTAINER_TESTS") == "1" {
		t.Skip("skipping MinIO integration test (SKIP_CONTAINER_TESTS=1)")
	}
	testcontainers.SkipIfProviderIsNotHealthy(t)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	container, err := tcminio.Run(
		ctx,
		image,
		tcminio.WithUsername("memos-test-access"),
		tcminio.WithPassword("memos-test-secret"),
	)
	require.NoError(t, err)
	testcontainers.CleanupContainer(t, container)

	connection, err := container.ConnectionString(ctx)
	require.NoError(t, err)
	server := &Server{
		Endpoint: "http://" + connection,
		Region:   "us-east-1",
		Username: container.Username,
		Password: container.Password,
	}

	config, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(server.Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(server.Username, server.Password, "")),
	)
	require.NoError(t, err)
	server.client = awss3.NewFromConfig(config, func(options *awss3.Options) {
		options.BaseEndpoint = aws.String(server.Endpoint)
		options.UsePathStyle = true
	})
	for _, bucket := range buckets {
		_, err := server.client.CreateBucket(ctx, &awss3.CreateBucketInput{Bucket: aws.String(bucket)})
		require.NoError(t, err)
	}

	return server
}

// Config returns a storage configuration connected to the requested bucket.
func (s *Server) Config(bucket string) *storepb.StorageS3Config {
	return &storepb.StorageS3Config{
		AccessKeyId:     s.Username,
		AccessKeySecret: s.Password,
		Endpoint:        s.Endpoint,
		Region:          s.Region,
		Bucket:          bucket,
		UsePathStyle:    true,
	}
}

// PutObject uploads an object directly for arranging a test fixture.
func (s *Server) PutObject(bucket, key, contentType string, content []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, err := s.client.PutObject(ctx, &awss3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Body:        bytes.NewReader(content),
	})
	return err
}

// GetObject reads an object directly for asserting test results.
func (s *Server) GetObject(bucket, key string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	object, err := s.client.GetObject(ctx, &awss3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	defer object.Body.Close()
	return io.ReadAll(object.Body)
}
