package s3

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type Config struct {
	AccessKey string
	SecretKey string
	Bucket    string
	EndPoint  string
	Region    string
	URLPrefix string
	URLSuffix string
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
	uploadOutput, err := uploader.Upload(ctx, &awss3.PutObjectInput{
		Bucket:      aws.String(client.Config.Bucket),
		Key:         aws.String(filename),
		Body:        src,
		ContentType: aws.String(fileType),
		ACL:         types.ObjectCannedACL(*aws.String("public-read")),
	})
	if err != nil {
		return "", err
	}

	link := uploadOutput.Location
	// If url prefix is set, use it as the file link.
	if client.Config.URLPrefix != "" {
		link = fmt.Sprintf("%s/%s%s", client.Config.URLPrefix, filename, client.Config.URLSuffix)
	}
	if link == "" {
		return "", errors.New("failed to get file link")
	}
	return link, nil
}
