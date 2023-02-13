package s3

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/usememos/memos/api"
)

type Client struct {
	Client     *awss3.Client
	BucketName string
	URLPrefix  string
}

func NewClient(ctx context.Context, storage *api.Storage) (*Client, error) {
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:           storage.EndPoint,
			SigningRegion: storage.Region,
		}, nil
	})

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithEndpointResolverWithOptions(resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(storage.AccessKey, storage.SecretKey, "")),
	)
	if err != nil {
		return nil, err
	}

	client := awss3.NewFromConfig(cfg)

	return &Client{
		Client:     client,
		BucketName: storage.Bucket,
		URLPrefix:  storage.URLPrefix,
	}, nil
}

func (client *Client) UploadFile(ctx context.Context, filename string, fileType string, src io.Reader, storage *api.Storage) (*string, error) {
	uploader := manager.NewUploader(client.Client)
	resp, err := uploader.Upload(ctx, &awss3.PutObjectInput{
		Bucket:      aws.String(client.BucketName),
		Key:         aws.String(filename),
		Body:        src,
		ContentType: aws.String(fileType),
		ACL:         types.ObjectCannedACL(*aws.String("public-read")),
	})
	if err != nil {
		return nil, err
	}
	var link string
	if storage.URLPrefix == "" {
		link = resp.Location
	} else {
		link = fmt.Sprintf("%s/%s", storage.URLPrefix, filename)
	}
	return &link, nil
}
