package teststore

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
)

func TestConcurrentReadWrite(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	const numWorkers = 10
	const numIterations = 100

	wg := sync.WaitGroup{}
	wg.Add(numWorkers)

	for i := 0; i < numWorkers; i++ {
		go func() {
			for j := 0; j < numIterations; j++ {
				_, err := ts.CreateMemo(ctx, &store.Memo{
					CreatorID:  user.ID,
					Content:    fmt.Sprintf("test_content_%d", i),
					Visibility: store.Public,
				})
				require.NoError(t, err)
			}
		}()

		go func() {
			_, err := ts.ListMemos(ctx, &store.FindMemo{
				CreatorID: &user.ID,
			})
			require.NoError(t, err)
			wg.Done()
		}()
	}

	wg.Wait()
}
