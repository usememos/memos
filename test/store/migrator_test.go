package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMigrateResourceInternalPath(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	testCases := []map[string]string{
		{
			ts.Profile.Data + "/assets/test.jpg": "assets/test.jpg",
		},
		{
			ts.Profile.Data + `\assets\test.jpg`: "assets/test.jpg",
		},
		{
			"/unhandled/path/test.jpg": "/unhandled/path/test.jpg",
		},
		{
			`C:\unhandled\path\assets\test.jpg`: `C:\unhandled\path\assets\test.jpg`,
		},
	}

	for _, testCase := range testCases {
		for input, expectedOutput := range testCase {
			resourceCreate := &store.Resource{
				CreatorID:    user.ID,
				InternalPath: input,
			}
			createdResource, err := ts.CreateResource(ctx, resourceCreate)
			require.NoError(t, err)

			err = ts.MigrateResourceInternalPath(ctx)
			require.NoError(t, err)

			findResource := &store.FindResource{
				ID: &createdResource.ID,
			}
			resource, err := ts.GetResource(ctx, findResource)
			require.NoError(t, err)

			require.Equal(t, expectedOutput, resource.InternalPath)
		}
	}

	ts.Close()
}
