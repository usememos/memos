package webhook

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPostAsyncNilPayloadDoesNotPanic(t *testing.T) {
	require.NotPanics(t, func() {
		PostAsync(nil)
	})
}
