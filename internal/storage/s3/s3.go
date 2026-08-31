package s3

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4" //nolint:revive // goimports insists on aliasing versioned import paths
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ErrRangeNotSatisfiable reports a ranged read whose byte range falls outside
// the object, so HTTP handlers can answer 416 instead of 500.
var ErrRangeNotSatisfiable = errors.New("requested range not satisfiable")

// RangeNotSatisfiableError carries response metadata for an unsatisfied range.
type RangeNotSatisfiableError struct {
	ContentRange string
}

func (*RangeNotSatisfiableError) Error() string {
	return ErrRangeNotSatisfiable.Error()
}

func (*RangeNotSatisfiableError) Unwrap() error {
	return ErrRangeNotSatisfiable
}

// ObjectStream is object content with the metadata needed to answer HTTP
// range requests.
type ObjectStream struct {
	Body io.ReadCloser
	// ContentLength is the number of bytes in Body, or -1 when unknown.
	ContentLength int64
	// ContentRange echoes the backend's Content-Range header for partial reads;
	// empty when the whole object is returned.
	ContentRange string
}

// Driver stores attachment objects in an S3-compatible object store.
type Driver struct {
	Client *s3.Client
	Bucket *string
}

// NewDriver creates an S3 storage driver from the supplied configuration.
func NewDriver(ctx context.Context, s3Config *storepb.StorageS3Config) (*Driver, error) {
	loadOptions := []func(*config.LoadOptions) error{
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(s3Config.AccessKeyId, s3Config.AccessKeySecret, "")),
		config.WithRegion(s3Config.Region),
	}
	if s3Config.InsecureSkipTlsVerify {
		// Skip TLS certificate verification for endpoints using self-signed certificates.
		// This is opt-in and removes protection against man-in-the-middle attacks.
		httpClient := awshttp.NewBuildableClient().WithTransportOptions(func(tr *http.Transport) {
			tr.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} // #nosec G402 -- opt-in for self-signed S3 endpoints
		})
		loadOptions = append(loadOptions, config.WithHTTPClient(httpClient))
	}

	cfg, err := config.LoadDefaultConfig(ctx, loadOptions...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load s3 config")
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(s3Config.Endpoint)
		o.UsePathStyle = s3Config.UsePathStyle
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
		o.APIOptions = append(o.APIOptions, excludeAcceptEncodingFromSigning, forceSignedPayload)
	})
	return &Driver{
		Client: client,
		Bucket: aws.String(s3Config.Bucket),
	}, nil
}

type acceptEncodingKey struct{}

type dropAcceptEncoding struct{}

func (dropAcceptEncoding) ID() string { return "MemosDropAcceptEncoding" }

func (dropAcceptEncoding) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
	if req, ok := in.Request.(*smithyhttp.Request); ok {
		if values := req.Header.Values("Accept-Encoding"); len(values) > 0 {
			ctx = context.WithValue(ctx, acceptEncodingKey{}, values)
			req.Header.Del("Accept-Encoding")
		}
	}
	return next.HandleFinalize(ctx, in)
}

type restoreAcceptEncoding struct{}

func (restoreAcceptEncoding) ID() string { return "MemosRestoreAcceptEncoding" }

func (restoreAcceptEncoding) HandleFinalize(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
	if req, ok := in.Request.(*smithyhttp.Request); ok {
		if values, ok := ctx.Value(acceptEncodingKey{}).([]string); ok {
			for _, value := range values {
				req.Header.Add("Accept-Encoding", value)
			}
		}
	}
	return next.HandleFinalize(ctx, in)
}

// excludeAcceptEncodingFromSigning keeps the Accept-Encoding header out of the
// SigV4 signature while still sending it on the wire. Some S3-compatible
// providers (notably Google Cloud Storage) rewrite the header in transit, so a
// signature covering it never verifies and requests fail with
// SignatureDoesNotMatch.
func excludeAcceptEncodingFromSigning(stack *middleware.Stack) error {
	if err := stack.Finalize.Insert(dropAcceptEncoding{}, "Signing", middleware.Before); err != nil {
		return err
	}
	return stack.Finalize.Insert(restoreAcceptEncoding{}, "Signing", middleware.After)
}

// forceSignedPayload signs request payloads with their real SHA-256 instead of
// the UNSIGNED-PAYLOAD marker the SDK uses over TLS, which some S3-compatible
// providers (notably Google Cloud Storage) reject.
func forceSignedPayload(stack *middleware.Stack) error {
	_, err := stack.Finalize.Swap((*v4.ComputePayloadSHA256)(nil).ID(), &v4.ComputePayloadSHA256{})
	return err
}

// UploadObject uploads an object to S3.
func (c *Driver) UploadObject(ctx context.Context, key string, fileType string, content io.Reader) (string, error) {
	putInput := s3.PutObjectInput{
		Bucket:      c.Bucket,
		Key:         aws.String(key),
		ContentType: aws.String(fileType),
		Body:        content,
	}
	if _, err := c.Client.PutObject(ctx, &putInput); err != nil {
		return "", errors.Wrap(err, "failed to upload object")
	}
	return key, nil
}

// GetObject retrieves an object from S3.
func (c *Driver) GetObject(ctx context.Context, key string) ([]byte, error) {
	stream, err := c.GetObjectStream(ctx, key, "")
	if err != nil {
		return nil, err
	}
	defer stream.Body.Close()
	data, err := io.ReadAll(stream.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read object body")
	}
	return data, nil
}

// GetObjectStream retrieves an object from S3 as a stream. A non-empty
// byteRange is forwarded as an HTTP Range header (e.g. "bytes=0-1023") and
// yields a partial object with ContentRange set. Callers must supply at most
// one range because S3 does not support multipart range responses.
func (c *Driver) GetObjectStream(ctx context.Context, key string, byteRange string) (*ObjectStream, error) {
	input := &s3.GetObjectInput{
		Bucket: c.Bucket,
		Key:    aws.String(key),
	}
	if byteRange != "" {
		input.Range = aws.String(byteRange)
	}
	output, err := c.Client.GetObject(ctx, input)
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "InvalidRange" {
			rangeErr := &RangeNotSatisfiableError{}
			var responseErr *smithyhttp.ResponseError
			if errors.As(err, &responseErr) && responseErr.Response != nil && responseErr.Response.Response != nil {
				rangeErr.ContentRange = responseErr.Response.Header.Get("Content-Range")
			}
			if rangeErr.ContentRange == "" {
				head, headErr := c.Client.HeadObject(ctx, &s3.HeadObjectInput{
					Bucket: c.Bucket,
					Key:    aws.String(key),
				})
				if headErr == nil && head.ContentLength != nil {
					rangeErr.ContentRange = fmt.Sprintf("bytes */%d", *head.ContentLength)
				}
			}
			return nil, rangeErr
		}
		return nil, errors.Wrap(err, "failed to get object")
	}
	stream := &ObjectStream{
		Body:          output.Body,
		ContentLength: -1,
	}
	if output.ContentLength != nil {
		stream.ContentLength = *output.ContentLength
	}
	if output.ContentRange != nil {
		stream.ContentRange = *output.ContentRange
	}
	return stream, nil
}

// DeleteObject deletes an object in S3.
func (c *Driver) DeleteObject(ctx context.Context, key string) error {
	_, err := c.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: c.Bucket,
		Key:    aws.String(key),
	})
	if err != nil {
		return errors.Wrap(err, "failed to delete object")
	}
	return nil
}
