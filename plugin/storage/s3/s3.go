package s3

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/pkg/errors"
)

const LinkLifetime = 24 * time.Hour

type Config struct {
	AccessKey string
	SecretKey string
	Bucket    string
	EndPoint  string
	Region    string
	URLPrefix string
	URLSuffix string
	PreSign   bool
}

type Client struct {
	Client *awss3.Client
	Config *Config
}

func NewClient(ctx context.Context, config *Config) (*Client, error) {
	// For some s3-compatible object stores, converting the hostname is not required,
	// and not setting this option will result in not being able to access the corresponding object store address.
	// But Aliyun OSS should disable this option
	hostnameImmutable := true
	if strings.HasSuffix(config.EndPoint, "aliyuncs.com") {
		hostnameImmutable = false
	}
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               config.EndPoint,
			SigningRegion:     config.Region,
			HostnameImmutable: hostnameImmutable,
		}, nil
	})

	awsConfig, err := s3config.LoadDefaultConfig(ctx,
		s3config.WithEndpointResolverWithOptions(resolver),
		s3config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(config.AccessKey, config.SecretKey, "")),
		s3config.WithRegion(config.Region),
	)
	if err != nil {
		return nil, err
	}

	client := awss3.NewFromConfig(awsConfig)

	return &Client{
		Client: client,
		Config: config,
	}, nil
}

func (client *Client) UploadFile(ctx context.Context, filename string, fileType string, src io.Reader) (string, error) {
	uploader := manager.NewUploader(client.Client)
	putInput := awss3.PutObjectInput{
		Bucket:      aws.String(client.Config.Bucket),
		Key:         aws.String(filename),
		Body:        src,
		ContentType: aws.String(fileType),
	}
	// Set ACL according to if url prefix is set.
	if client.Config.URLPrefix == "" && !client.Config.PreSign {
		putInput.ACL = types.ObjectCannedACL(*aws.String("public-read"))
	}
	uploadOutput, err := uploader.Upload(ctx, &putInput)
	if err != nil {
		return "", err
	}

	link := uploadOutput.Location
	// If url prefix is set, use it as the file link.
	if client.Config.URLPrefix != "" {
		parts := strings.Split(filename, "/")
		for i := range parts {
			parts[i] = url.PathEscape(parts[i])
		}
		link = fmt.Sprintf("%s/%s%s", client.Config.URLPrefix, strings.Join(parts, "/"), client.Config.URLSuffix)
	}
	if link == "" {
		return "", errors.New("failed to get file link")
	}
	if client.Config.PreSign {
		return client.PreSignLink(ctx, link)
	}
	return link, nil
}

// PreSignLink generates a pre-signed URL for the given sourceLink.
// If the link does not belong to the configured storage endpoint, it is returned as-is.
// If the link belongs to the storage, the function generates a pre-signed URL using the AWS S3 client.
func (client *Client) PreSignLink(ctx context.Context, sourceLink string) (string, error) {
	u, err := url.Parse(sourceLink)
	if err != nil {
		return "", errors.Wrapf(err, "parse URL")
	}
	// if link doesn't belong to storage, then return as-is.
	// the empty hostname is corner-case for AWS native endpoint.
	endpointURL, err := url.Parse(client.Config.EndPoint)
	if err != nil {
		return "", errors.Wrapf(err, "parse Endpoint URL")
	}
	endpointHost := endpointURL.Hostname()
	if client.Config.Bucket != "" && !strings.Contains(endpointHost, client.Config.Bucket) {
		endpointHost = fmt.Sprintf("%s.%s", client.Config.Bucket, endpointHost)
	}
	if client.Config.EndPoint != "" && !strings.Contains(endpointHost, u.Hostname()) {
		return sourceLink, nil
	}

	filename := u.Path
	if prefixLen := len(client.Config.URLPrefix); len(filename) >= prefixLen {
		filename = filename[prefixLen:]
	}
	if suffixLen := len(client.Config.URLSuffix); len(filename) >= suffixLen {
		filename = filename[:len(filename)-suffixLen]
	}
	filename = strings.Trim(filename, "/")
	if strings.HasPrefix(filename, client.Config.Bucket) {
		filename = strings.Trim(filename[len(client.Config.Bucket):], "/")
	}

	req, err := awss3.NewPresignClient(client.Client).PresignGetObject(ctx, &awss3.GetObjectInput{
		Bucket: aws.String(client.Config.Bucket),
		Key:    aws.String(filename),
	}, awss3.WithPresignExpires(LinkLifetime))
	if err != nil {
		return "", errors.Wrapf(err, "pre-sign link")
	}
	return req.URL, nil
}
