package rdsiam

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/stretchr/testify/require"
)

func TestToken(t *testing.T) {
	source := NewStaticTokenSource("eu-west-1", credentials.NewStaticCredentialsProvider("AKIDEXAMPLE", "secret", ""))

	token, err := source.Token(context.Background(), "db.example.eu-west-1.rds.amazonaws.com", 5432, "memos")
	require.NoError(t, err)

	host, rawQuery, ok := strings.Cut(token, "?")
	require.True(t, ok, "token %q has no query", token)
	require.Equal(t, "db.example.eu-west-1.rds.amazonaws.com:5432", host)
	query, err := url.ParseQuery(rawQuery)
	require.NoError(t, err)
	require.Equal(t, "connect", query.Get("Action"))
	require.Equal(t, "memos", query.Get("DBUser"))
	require.Contains(t, query.Get("X-Amz-Credential"), "/eu-west-1/rds-db/aws4_request")
	require.NotEmpty(t, query.Get("X-Amz-Signature"))
}

func TestTokenRegionFromHost(t *testing.T) {
	source := NewStaticTokenSource("", credentials.NewStaticCredentialsProvider("AKIDEXAMPLE", "secret", ""))
	ctx := context.Background()

	token, err := source.Token(ctx, "db.cluster-abc123.us-east-2.rds.amazonaws.com", 3306, "memos")
	require.NoError(t, err)
	require.Contains(t, token, "%2Fus-east-2%2Frds-db%2F")

	_, err = source.Token(ctx, "db.internal.example.com", 3306, "memos")
	require.ErrorContains(t, err, "set AWS_REGION")
}

func TestRegionFromHost(t *testing.T) {
	for host, want := range map[string]string{
		"db.abc123.eu-west-1.rds.amazonaws.com":                 "eu-west-1",
		"db.cluster-ro-abc123.eu-west-1.rds.amazonaws.com":      "eu-west-1",
		"proxy.proxy-abc123.us-east-2.rds.amazonaws.com.":       "us-east-2",
		"db.abc123.rds.cn-north-1.amazonaws.com.cn":             "cn-north-1",
		"db.cluster-abc123.rds.cn-northwest-1.amazonaws.com.cn": "cn-northwest-1",
		"db.abc123.cn-north-1.rds.amazonaws.com.cn":             "",
		"s3.cn-north-1.amazonaws.com.cn":                        "",
		"DB.ABC123.EU-WEST-1.RDS.AMAZONAWS.COM":                 "eu-west-1",
		"db.internal.example.com":                               "",
		"10.0.0.12":                                             "",
	} {
		require.Equal(t, want, regionFromHost(host), host)
	}
}

func TestTokenRequiresEndpointAndUser(t *testing.T) {
	source := NewStaticTokenSource("eu-west-1", credentials.NewStaticCredentialsProvider("AKIDEXAMPLE", "secret", ""))
	ctx := context.Background()

	_, err := source.Token(ctx, "", 5432, "memos")
	require.Error(t, err)
	_, err = source.Token(ctx, "db.example.com", 0, "memos")
	require.Error(t, err)
	_, err = source.Token(ctx, "db.example.com", 5432, "")
	require.Error(t, err)
}
