package v1

import (
	"testing"

	"golang.org/x/exp/slices"
)

func TestFindTagListFromMemoContent(t *testing.T) {
	tests := []struct {
		memoContent string
		want        []string
	}{
		{
			memoContent: "#tag1 ",
			want:        []string{"tag1"},
		},
		{
			memoContent: "#tag1 #tag2 ",
			want:        []string{"tag1", "tag2"},
		},
		{
			memoContent: "#tag1 #tag2 \n#tag3 ",
			want:        []string{"tag1", "tag2", "tag3"},
		},
		{
			memoContent: "#tag1 #tag2 \n#tag3 #tag4 ",
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: "#tag1 #tag2 \n#tag3  #tag4 ",
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: "#tag1 123123#tag2 \n#tag3  #tag4 ",
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: "#tag1 http://123123.com?123123#tag2 \n#tag3  #tag4 http://123123.com?123123#tag2) ",
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: "#tag1,#tag2! #tag3.. #tag_4",
			want:        []string{"tag1", "tag2", "tag3", "tag_4"},
		},
	}
	for _, test := range tests {
		result := findTagListFromMemoContent(test.memoContent)
		if !slices.Equal(result, test.want) {
			t.Errorf("Find tag list %s: got result %v, want %v.", test.memoContent, result, test.want)
		}
	}
}
