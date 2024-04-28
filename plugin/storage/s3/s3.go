package s3

import (
	"context"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/pkg/errors"
)

const LinkLifetime = 24 * time.Hour

type Config struct {
	AccessKeyID     string
	AcesssKeySecret string
	Endpoint        string
	Region          string
	Bucket          string
}

type Client struct {
	Client *awss3.Client
	Config *Config
}

func NewClient(ctx context.Context, config *Config) (*Client, error) {
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL: config.Endpoint,
		}, nil
	})
	s3Config, err := s3config.LoadDefaultConfig(ctx,
		s3config.WithEndpointResolverWithOptions(resolver),
		s3config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(config.AccessKeyID, config.AcesssKeySecret, "")),
		s3config.WithRegion(config.Region),
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load s3 config")
	}

	client := awss3.NewFromConfig(s3Config)
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
	uploadOutput, err := uploader.Upload(ctx, &putInput)
	if err != nil {
		return "", err
	}

	link := uploadOutput.Location
	if link == "" {
		return "", errors.New("failed to get file link")
	}
	return link, nil
}
