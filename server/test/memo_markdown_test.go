package test

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestMemoMarkdownStartup exercises route registration through the full server.
func TestMemoMarkdownStartup(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{})
	st := inst.server.Store
	_, err := st.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC,
		}},
	})
	require.NoError(t, err)
	owner, err := st.CreateUser(ctx, &store.User{Username: "markdown-owner", Email: "markdown@example.com", Role: store.RoleUser})
	require.NoError(t, err)
	const content = "# Héllo\n\n```go\nprintln(1)\n```\n"
	memo, err := st.CreateMemo(ctx, &store.Memo{UID: "markdown-startup", CreatorID: owner.ID, Content: content, Visibility: store.Public})
	require.NoError(t, err)
	for _, tc := range []struct {
		name, suffix, accept string
		markdown             bool
		status               int
	}{
		{"suffix", ".md", "", true, http.StatusOK},
		{"negotiated", "", "text/markdown", true, http.StatusOK},
		{"browser", "", "text/html,*/*", false, http.StatusOK},
		{"default", "", "", false, http.StatusOK},
		{"wildcard", "", "*/*", false, http.StatusOK},
		{"disabled", "", "text/markdown;q=0", false, http.StatusOK},
		{"missing", "-missing.md", "", true, http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, inst.baseURL+"/memos/"+memo.UID+tc.suffix, nil)
			require.NoError(t, err)
			req.Header.Set("Accept", tc.accept)
			resp, err := inst.client.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, tc.status, resp.StatusCode)
			require.Contains(t, resp.Header.Values("Vary"), "Accept")
			if tc.markdown {
				require.NotContains(t, string(body), "<html")
				require.Contains(t, resp.Header.Get("Cache-Control"), "no-store")
				if tc.status == http.StatusOK {
					require.Equal(t, content, string(body))
					require.Equal(t, "text/markdown; charset=utf-8", resp.Header.Get("Content-Type"))
				}
			} else {
				require.Contains(t, string(body), "<html")
				require.NotContains(t, string(body), content)
			}
		})
	}
}
