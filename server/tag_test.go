package server

import (
	"sort"
	"testing"
)

func TestFindTagListFromMemoContent(t *testing.T) {
	tests := []struct {
		memoContent []string
		want        []string
	}{
		{
			memoContent: []string{"#tag1 "},
			want:        []string{"tag1"},
		},
		{
			memoContent: []string{"#tag1 #tag2 "},
			want:        []string{"tag1", "tag2"},
		},
		{
			memoContent: []string{"#tag1 #tag2 \n#tag3 "},
			want:        []string{"tag1", "tag2", "tag3"},
		},
		{
			memoContent: []string{"#tag1 #tag2 \n#tag3 #tag4 "},
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: []string{"#tag1 #tag2 \n#tag3  #tag4 "},
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: []string{"#tag1 #tag2 \n#tag3  #tag4 ", "#tag1 #tag2 \n#tag3  #tag4 "},
			want:        []string{"tag1", "tag2", "tag3", "tag4"},
		},
		{
			memoContent: []string{"#tag1 #tag2 \n#tag3  #tag4 ", "#tag1 #tag2 \n#tag3  #tag4 #tag5 "},
			want:        []string{"tag1", "tag2", "tag3", "tag4", "tag5"},
		},
	}
	for _, test := range tests {
		tagMapSet := make(map[string]bool)
		for _, memo := range test.memoContent {
			memoTags := findTagSetFromMemoContent(memo)
			for k, v := range memoTags {
				tagMapSet[k] = v
			}
		}
		result := []string{}
		for tag := range tagMapSet {
			result = append(result, tag)
		}
		sort.Strings(result)
		if len(result) != len(test.want) {
			t.Errorf("Find tag list %s: got result %v, want %v.", test.memoContent, result, test.want)
		}
	}
}
