// Package rdsiam signs Amazon RDS IAM authentication tokens.
//
// A token stands in for the database password. It is valid for 15 minutes and
// is only checked when a connection is established, so callers sign a fresh one
// for every new connection instead of caching it.
package rdsiam

import (
	"context"
	"net"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/rds/auth"
	"github.com/pkg/errors"
)

// TokenSource signs RDS IAM authentication tokens with one set of AWS credentials.
type TokenSource struct {
	region      string
	credentials aws.CredentialsProvider
}

// NewTokenSource loads AWS credentials and region from the default chain:
// environment variables, shared config files, web identity, and container or
// instance roles.
func NewTokenSource(ctx context.Context) (*TokenSource, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load AWS config")
	}
	return NewStaticTokenSource(cfg.Region, cfg.Credentials), nil
}

// NewStaticTokenSource signs tokens with the given credentials. region is used
// when it cannot be read from the database host name.
func NewStaticTokenSource(region string, credentials aws.CredentialsProvider) *TokenSource {
	return &TokenSource{region: region, credentials: credentials}
}

// Token returns an authentication token for user on the database at host:port.
func (s *TokenSource) Token(ctx context.Context, host string, port int, user string) (string, error) {
	if host == "" || port == 0 {
		return "", errors.New("RDS IAM authentication requires a database host and port")
	}
	if user == "" {
		return "", errors.New("RDS IAM authentication requires a database user")
	}
	region := regionFromHost(host)
	if region == "" {
		region = s.region
	}
	if region == "" {
		return "", errors.Errorf("cannot infer the AWS region from database host %q; set AWS_REGION", host)
	}
	endpoint := net.JoinHostPort(host, strconv.Itoa(port))
	token, err := auth.BuildAuthToken(ctx, endpoint, region, user, s.credentials)
	if err != nil {
		return "", errors.Wrap(err, "failed to build RDS IAM authentication token")
	}
	return token, nil
}

// regionFromHost returns the region in an RDS endpoint such as
// "db.abc123.eu-west-1.rds.amazonaws.com" or, in the China partition,
// "db.abc123.rds.cn-north-1.amazonaws.com.cn". It returns "" for any other
// host name.
func regionFromHost(host string) string {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if prefix, ok := strings.CutSuffix(host, ".rds.amazonaws.com"); ok {
		if _, region, ok := strings.CutLast(prefix, "."); ok {
			return region
		}
	}
	if prefix, ok := strings.CutSuffix(host, ".amazonaws.com.cn"); ok {
		if rest, region, ok := strings.CutLast(prefix, "."); ok && strings.HasSuffix(rest, ".rds") {
			return region
		}
	}
	return ""
}
