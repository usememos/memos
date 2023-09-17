package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/api/v1"
)

func TestSystemServer(t *testing.T) {
	ctx := context.Background()
	s, err := NewTestingServer(ctx, t)
	require.NoError(t, err)
	defer s.Shutdown(ctx)

	status, err := s.getSystemStatus()
	require.NoError(t, err)
	require.Equal(t, (*apiv1.User)(nil), status.Host)

	signup := &apiv1.SignUp{
		Username: "testuser",
		Password: "testpassword",
	}
	user, err := s.postAuthSignUp(signup)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	err = s.pingSystem()
	require.NoError(t, err)
	status, err = s.getSystemStatus()
	require.NoError(t, err)
	require.Equal(t, user.ID, status.Host.ID)
}

func (s *TestingServer) pingSystem() error {
	_, err := s.get("/api/v1/ping", nil)
	if err != nil {
		return err
	}
	return nil
}

func (s *TestingServer) getSystemStatus() (*apiv1.SystemStatus, error) {
	body, err := s.get("/api/v1/status", nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	systemStatus := &apiv1.SystemStatus{}
	if err = json.Unmarshal(buf.Bytes(), systemStatus); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get system status response")
	}
	return systemStatus, nil
}
