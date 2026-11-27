package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMaskAPIKeyHidesAtLeastHalf(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{name: "empty", key: "", want: ""},
		{name: "eight characters", key: "abcdefgh", want: "..."},
		{name: "nine characters", key: "abcdefghi", want: "..."},
		{name: "eleven characters", key: "abcdefghijk", want: "..."},
		{name: "fifteen characters", key: "abcdefghijklmno", want: "..."},
		{name: "sixteen characters", key: "abcdefghijklmnop", want: "abcd...mnop"},
		{name: "long key", key: "sk-1234567890abcdefghijklmnopqrstuvwxyz", want: "sk-1...wxyz"},
		{name: "ten runes in sixteen bytes", key: "abcd🔑🔑efgh", want: "..."},
		{name: "sixteen multi-byte runes", key: "🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑", want: "🔑🔑🔑🔑...🔑🔑🔑🔑"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, maskAPIKey(test.key))
		})
	}
}
