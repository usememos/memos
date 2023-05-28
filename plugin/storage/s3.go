package storage

import (
	"context"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Client struct {
	client     *awss3.Client
	signClient *awss3.PresignClient
	uploader   *manager.Uploader
	cfg        *S3Config
}

type S3Config struct {
	EndPoint  string `json:"endPoint"`
	Region    string `json:"region"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
	IsPrivate bool   `json:"isPrivate"`
	Path      string `json:"path,omitempty"`
	URLPrefix string `json:"urlPrefix,omitempty"`
	URLSuffix string `json:"urlSuffix,omitempty"`
}

func NewS3Client(ctx context.Context, config *S3Config) (*S3Client, error) {
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:           config.EndPoint,
			SigningRegion: config.Region,
			// For some s3-compatible object stores, converting the hostname is not required,
			// and not setting this option will result in not being able to access the corresponding object store address.
			HostnameImmutable: true,
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

	return &S3Client{
		client:     client,
		signClient: awss3.NewPresignClient(client),
		uploader:   manager.NewUploader(client),
		cfg:        config,
	}, nil
}

func (c *S3Client) GetPathTemplate() string {
	return c.cfg.Path
}

func (c *S3Client) StoreFile(ctx context.Context, key, fileType string, reader io.Reader) (string, error) {
	ret, err := c.uploader.Upload(ctx, &awss3.PutObjectInput{
		Bucket:      aws.String(c.cfg.Bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(fileType),
	})
	if err != nil {
		return "", err
	}

	if c.cfg.URLPrefix != "" || c.cfg.URLSuffix != "" {
		return c.cfg.URLPrefix + "/" + key + c.cfg.URLSuffix, nil
	}

	return ret.Location, nil
}

func (c *S3Client) TrySignLink(ctx context.Context, link string) (string, error) {
	if !strings.Contains(link, c.cfg.EndPoint) {
		return link, nil
	}

	if !c.cfg.IsPrivate || c.cfg.URLPrefix != "" || c.cfg.URLSuffix != "" {
		return link, nil
	}

	u, err := url.Parse(link)
	if err != nil {
		return "", err
	}

	key := u.Path
	if strings.HasPrefix(key, "/"+c.cfg.Bucket) {
		key = strings.TrimPrefix(key, "/"+c.cfg.Bucket+"/")
	}

	req, err := c.signClient.PresignGetObject(ctx, &awss3.GetObjectInput{
		Bucket: aws.String(c.cfg.Bucket),
		Key:    aws.String(key),
	}, func(opts *awss3.PresignOptions) {
		opts.Expires = time.Hour
	})
	if err != nil {
		return "", err
	}

	return req.URL, nil
}
